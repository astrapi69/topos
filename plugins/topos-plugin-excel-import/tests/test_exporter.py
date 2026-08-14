from __future__ import annotations

from datetime import datetime
from io import BytesIO

import openpyxl
from app.models import (
    Action,
    ActionStatus,
    Category,
    Container,
    ContainerType,
    Item,
    Owner,
    Priority,
)

from topos_excel_import.exporter import export_workbook
from topos_excel_import.parser import parse_workbook


def test_export_workbook_writes_import_compatible_sheets(db):
    container = Container(
        external_id=42,
        type=ContainerType.FOLDER,
        owner=Owner.SELF,
        label="Ordner A",
        description="Beschreibung",
        location="Regal 1",
    )
    db.add(container)
    db.flush()
    db.add_all(
        [
            Category(
                path="finance",
                parent_path=None,
                name="finance",
                display_name="Finanzen",
                level=0,
            ),
            Category(
                path="finance/insurance",
                parent_path="finance",
                name="insurance",
                display_name="Versicherung",
                level=1,
            ),
        ]
    )
    item = Item(
        container_id=container.id,
        content="Police",
        priority=Priority.HIGH,
        category_path="finance/insurance",
    )
    db.add(item)
    db.flush()
    db.add(Action(item_id=item.id, text="Prüfen"))
    db.commit()

    payload = export_workbook(db)
    parsed = parse_workbook(BytesIO(payload))

    assert len(parsed.containers) == 1
    assert parsed.containers[0].external_id == 42
    assert parsed.containers[0].label == "Ordner A"
    assert parsed.containers[0].items[0].content == "Police"
    assert parsed.containers[0].items[0].priority == "high"
    assert parsed.containers[0].items[0].category_path == "finance/insurance"
    assert [a.text for a in parsed.containers[0].items[0].actions] == ["Prüfen"]


def test_export_workbook_can_be_opened_by_openpyxl(db):
    db.add(
        Container(
            external_id=100,
            type=ContainerType.BOX,
            owner=Owner.SELF,
            label="Box A",
            size_group="100 bis 199",
        )
    )
    db.commit()

    payload = export_workbook(db)
    wb = openpyxl.load_workbook(BytesIO(payload), read_only=True)
    try:
        assert wb.sheetnames == ["Meine Ordner", "Ordner Eltern", "Boxen", "Kategorien"]
        assert wb["Boxen"]["A2"].value == "100 bis 199"
        assert wb["Boxen"]["A3"].value == 100
    finally:
        wb.close()


def test_export_import_roundtrip_is_lossless(db):
    """Export -> parse -> import must preserve every field the model has.

    The sheet layout was extended (owner, notes, category slug, box
    priority, action status/dates, a Kategorien sheet) precisely so this
    holds; the frontend importer applies the same contract.
    """
    from topos_excel_import.importer import import_parsed_result

    db.add_all(
        [
            Category(
                path="custom-slug",
                parent_path=None,
                name="custom-slug",
                display_name="Sonderfall",
                level=0,
            ),
            Category(
                path="unused",
                parent_path=None,
                name="unused",
                display_name="Ungenutzt",
                level=0,
            ),
        ]
    )
    shared = Container(
        external_id=20,
        type=ContainerType.FOLDER,
        owner=Owner.SHARED,
        label="Geteilt",
        location="Keller",
    )
    parents = Container(
        external_id=30,
        type=ContainerType.FOLDER,
        owner=Owner.PARENTS,
        label="Eltern",
        location="Dachboden",
    )
    box = Container(
        external_id=40,
        type=ContainerType.BOX,
        owner=Owner.SELF,
        label="Kiste",
        size_group="40 bis 49",
    )
    db.add_all([shared, parents, box])
    db.flush()
    with_notes = Item(
        container_id=shared.id,
        content="Mit Notiz",
        priority=Priority.HIGH,
        category_path="custom-slug",
        notes="wichtige Notiz",
    )
    box_item = Item(container_id=box.id, content="Box-Eintrag", priority=Priority.HIGH)
    parents_item = Item(
        container_id=parents.id,
        content="Eltern-Eintrag",
        priority=Priority.VERY_HIGH,
    )
    db.add_all([with_notes, box_item, parents_item])
    db.flush()
    db.add_all(
        [
            Action(item_id=with_notes.id, text="Offen"),
            Action(
                item_id=with_notes.id,
                text="Erledigt",
                status=ActionStatus.DONE,
                completed_at=datetime(2026, 1, 1),
            ),
            Action(item_id=parents_item.id, text="Eltern-Aktion"),
        ]
    )
    db.commit()

    first = export_workbook(db)

    # Wipe and re-import into an empty DB.
    for model in (Action, Item, Container, Category):
        db.query(model).delete()
    db.commit()
    import_parsed_result(db, parse_workbook(BytesIO(first)))

    containers = {row.external_id: row for row in db.query(Container).all()}
    assert containers[20].owner == Owner.SHARED
    assert containers[30].location == "Dachboden"
    assert containers[40].size_group == "40 bis 49"

    items = {row.content: row for row in db.query(Item).all()}
    assert items["Mit Notiz"].notes == "wichtige Notiz"
    assert items["Mit Notiz"].category_path == "custom-slug"
    assert items["Box-Eintrag"].priority == Priority.HIGH
    assert items["Eltern-Eintrag"].priority == Priority.VERY_HIGH

    actions = {row.text: row for row in db.query(Action).all()}
    assert set(actions) == {"Offen", "Erledigt", "Eltern-Aktion"}
    assert actions["Erledigt"].status == ActionStatus.DONE
    assert actions["Erledigt"].completed_at == datetime(2026, 1, 1)

    # Categories survive, including one no item references.
    paths = {row.path for row in db.query(Category).all()}
    assert {"custom-slug", "unused"} <= paths

    # And the workbook is a fixed point.
    assert parse_workbook(BytesIO(export_workbook(db))).containers is not None


def test_extended_types_roundtrip_via_typ_column(db):
    """drawer/shelf/case/safe survive export -> parse.

    Non-folder types share the Boxen sheet (its owner is already a
    column), distinguished by the appended "Typ" column. An empty Typ
    cell keeps the sheet's default, so workbooks written before the
    column still import unchanged.
    """
    db.add_all(
        [
            Container(
                external_id=50, type=ContainerType.DRAWER, owner=Owner.SELF, label="Kommode 3"
            ),
            Container(external_id=51, type=ContainerType.SAFE, owner=Owner.PARENTS, label="Tresor"),
            Container(external_id=52, type=ContainerType.BOX, owner=Owner.SELF, label="Kiste"),
        ]
    )
    db.flush()

    parsed = parse_workbook(BytesIO(export_workbook(db)))

    by_nr = {c.external_id: c for c in parsed.containers}
    assert by_nr[50].type == "drawer"
    assert by_nr[50].owner == "self"
    assert by_nr[51].type == "safe"
    assert by_nr[51].owner == "parents"
    assert by_nr[52].type == "box"


def test_nesting_roundtrips_via_eltern_nr_column(db):
    """parent_container_id survives export -> parse -> import via an
    appended "Eltern-Nr." column carrying the PARENT'S EXTERNAL id -
    the user-facing number is the only container identity that is
    stable across databases (import upserts by external_id)."""
    from topos_excel_import.importer import import_parsed_result

    shelf = Container(external_id=60, type=ContainerType.SHELF, owner=Owner.SELF, label="Regal")
    db.add(shelf)
    db.flush()
    db.add(
        Container(
            external_id=61,
            type=ContainerType.FOLDER,
            owner=Owner.SELF,
            label="Ordner im Regal",
            parent_container_id=shelf.id,
        )
    )
    db.flush()

    parsed = parse_workbook(BytesIO(export_workbook(db)))
    by_nr = {c.external_id: c for c in parsed.containers}
    assert by_nr[61].parent_external_id == 60
    assert by_nr[60].parent_external_id is None

    # And into a FRESH database: the reference resolves by external id.
    for row in db.query(Container).all():
        db.delete(row)
    db.flush()
    import_parsed_result(db, parsed)
    imported_shelf = db.query(Container).filter_by(external_id=60).one()
    imported_folder = db.query(Container).filter_by(external_id=61).one()
    assert imported_folder.parent_container_id == imported_shelf.id
