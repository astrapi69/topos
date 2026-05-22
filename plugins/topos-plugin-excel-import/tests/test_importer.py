"""Tests for the idempotent upsert + ancestor-chain category creation."""

from __future__ import annotations

from app.models import Action, ActionStatus, Category, Container, Item

from topos_excel_import.importer import import_parsed_result, import_workbook
from topos_excel_import.parser import ParsedContainer, ParsedItem, ParseResult

_HEADER = [
    "Ordner-Nr",
    "Ordnerbeschreibung",
    "Ordnerinhalt",
    "Prioritaet",
    "Kategorienpfad",
    "Ort",
    "Aktion",
    "neuer Ordner erforderlich",
]


def _seed_workbook(write_workbook) -> bytes:
    rows = [
        _HEADER,
        [1001.0, "Folder 1001", None, None, None, "Office", None, None],
        [None, None, "Bank statement", "hoch", "Finanzen/Bank", None, "request statement", None],
        [None, None, "Tax forms", "mittel", "Steuern", None, None, None],
        [1002.0, "Folder 1002", None, None, None, None, None, None],
        [None, None, "Insurance policy", "sehr hoch", "Versicherung", None, None, None],
    ]
    return write_workbook({"Meine Ordner": rows})


def test_first_import_creates_everything(db, write_workbook):
    report = import_workbook(db, _seed_workbook(write_workbook))
    assert report.containers_created == 2
    assert report.containers_updated == 0
    assert report.items_created == 3
    assert report.actions_created == 1
    # Categories: finance, finance/bank, taxes, insurance = 4 created
    assert report.categories_created == 4

    assert db.query(Container).count() == 2
    assert db.query(Item).count() == 3
    assert db.query(Action).count() == 1
    assert db.query(Category).count() == 4


def test_second_import_is_idempotent(db, write_workbook):
    blob = _seed_workbook(write_workbook)
    first = import_workbook(db, blob)
    second = import_workbook(db, blob)
    assert second.containers_created == 0
    assert second.containers_updated == first.containers_created
    assert second.items_created == 0
    assert second.actions_created == 0
    assert second.categories_created == 0

    assert db.query(Container).count() == 2
    assert db.query(Item).count() == 3
    assert db.query(Action).count() == 1


def test_existing_action_status_preserved_on_reimport(db, write_workbook):
    blob = _seed_workbook(write_workbook)
    import_workbook(db, blob)

    # Mark the action done outside the importer.
    action = db.query(Action).one()
    action.status = ActionStatus.DONE
    db.commit()

    import_workbook(db, blob)
    refreshed = db.query(Action).one()
    assert refreshed.status == ActionStatus.DONE


def test_prune_missing_deletes_items_no_longer_in_source(db, write_workbook):
    blob = _seed_workbook(write_workbook)
    import_workbook(db, blob)

    # Second workbook drops the "Tax forms" item from Folder 1001.
    rows = [
        _HEADER,
        [1001.0, "Folder 1001", None, None, None, "Office", None, None],
        [None, None, "Bank statement", "hoch", "Finanzen/Bank", None, "request statement", None],
        [1002.0, "Folder 1002", None, None, None, None, None, None],
        [None, None, "Insurance policy", "sehr hoch", "Versicherung", None, None, None],
    ]
    pruned_blob = write_workbook({"Meine Ordner": rows})

    # Default mode keeps the missing item.
    report_keep = import_workbook(db, pruned_blob)
    assert report_keep.items_pruned == 0
    assert db.query(Item).count() == 3

    # prune_missing=True removes it.
    report_prune = import_workbook(db, pruned_blob, prune_missing=True)
    assert report_prune.items_pruned == 1
    assert db.query(Item).count() == 2
    assert db.query(Item).filter(Item.content == "Tax forms").count() == 0


def test_ancestor_categories_are_created_for_every_level(db, write_workbook):
    rows = [
        _HEADER,
        [9001.0, "Folder 9001", None, None, None, None, None, None],
        [None, None, "Some bank doc", "hoch", "Finanzen/Bank/Girokonto", None, None, None],
    ]
    blob = write_workbook({"Meine Ordner": rows})
    report = import_workbook(db, blob)

    assert report.categories_created == 3
    paths = {c.path: c for c in db.query(Category).all()}
    assert set(paths) == {"finance", "finance/bank", "finance/bank/checking-account"}
    assert paths["finance"].parent_path is None
    assert paths["finance"].level == 0
    assert paths["finance/bank"].parent_path == "finance"
    assert paths["finance/bank"].level == 1
    leaf = paths["finance/bank/checking-account"]
    assert leaf.parent_path == "finance/bank"
    assert leaf.level == 2
    assert leaf.display_name == "Girokonto"


def test_display_name_is_german_original_even_when_slug_is_english(db, write_workbook):
    rows = [
        _HEADER,
        [9002.0, "Folder 9002", None, None, None, None, None, None],
        [None, None, "x", "keine", "Finanzen/Bank/Girokonto", None, None, None],
    ]
    blob = write_workbook({"Meine Ordner": rows})
    import_workbook(db, blob)
    cats = {c.path: c for c in db.query(Category).all()}
    assert cats["finance"].display_name == "Finanzen"
    assert cats["finance/bank"].display_name == "Bank"
    assert cats["finance/bank/checking-account"].display_name == "Girokonto"


def test_unmapped_priority_does_not_block_import(db, write_workbook):
    rows = [
        _HEADER,
        [9003.0, "Folder 9003", None, None, None, None, None, None],
        [None, None, "Item with weird priority", "super hoch", None, None, None, None],
    ]
    blob = write_workbook({"Meine Ordner": rows})
    report = import_workbook(db, blob)

    assert report.items_created == 1
    item = db.query(Item).one()
    assert item.priority.value == "none"
    assert any("super hoch" in w for w in report.warnings)


def test_synthetic_parse_result_imports_without_openpyxl(db):
    """Bypass openpyxl entirely to exercise import_parsed_result."""
    parsed = ParseResult(
        containers=[
            ParsedContainer(
                external_id=7777,
                type="folder",
                owner="self",
                label="Synthetic",
                location=None,
                size_group=None,
                items=[
                    ParsedItem(
                        content="synthetic item",
                        priority="low",
                        notes=None,
                        category_path="finance",
                        category_segments=[("finance", "Finanzen")],
                        action_texts=["one", "two"],
                    )
                ],
            )
        ],
    )
    report = import_parsed_result(db, parsed)
    assert report.containers_created == 1
    assert report.items_created == 1
    assert report.actions_created == 2
    assert report.categories_created == 1
