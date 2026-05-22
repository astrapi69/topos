"""Tests for the Excel parser.

Synthetic openpyxl workbooks exercise:

- Container row + item rows (Meine Ordner)
- Multi-row description continuation
- Ordner Eltern shape (no location, no actions)
- Boxen size-group range header detection
- Action splitting on ";"
- Unknown priority -> warning + Priority.NONE fallback
- Unknown category segment -> warning + mechanical slug
"""

from __future__ import annotations

from topos_excel_import.parser import parse_workbook

_HEADER_MEINE_ORDNER = [
    "Ordner-Nr",
    "Ordnerbeschreibung",
    "Ordnerinhalt",
    "Prioritaet",
    "Kategorienpfad",
    "Ort",
    "Aktion",
    "neuer Ordner erforderlich",
]
_HEADER_ORDNER_ELTERN = ["Ordner-Nr", "Beschreibung", "Inhalt", "Prioritaet"]
_HEADER_BOXEN = [
    "Box-Nr",
    "Box-Beschreibung",
    None,
    None,
    "Inhalt",
    "Kategorienpfad",
]


def test_meine_ordner_container_with_items_and_actions(write_workbook):
    rows = [
        _HEADER_MEINE_ORDNER,
        [1001.0, "Folder 1001", None, None, None, "Office", None, None],
        [None, None, "Bank statement", "hoch", "Finanzen/Bank", None, "request statement", None],
        [
            None,
            None,
            "Tax forms",
            "mittel",
            "Steuern",
            None,
            "review and possibly cancel; check meter reading",
            None,
        ],
    ]
    data = write_workbook({"Meine Ordner": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    assert len(parsed.containers) == 1
    container = parsed.containers[0]
    assert container.external_id == 1001
    assert container.label == "Folder 1001"
    assert container.location == "Office"
    assert container.owner == "self"
    assert container.type == "folder"
    assert len(container.items) == 2

    bank, tax = container.items
    assert bank.content == "Bank statement"
    assert bank.priority == "high"
    assert bank.category_path == "finance/bank"
    assert bank.category_segments == [("finance", "Finanzen"), ("bank", "Bank")]
    assert bank.action_texts == ["request statement"]

    assert tax.content == "Tax forms"
    assert tax.priority == "medium"
    assert tax.action_texts == ["review and possibly cancel", "check meter reading"]
    assert parsed.warnings == []


def test_multi_row_description_is_appended(write_workbook):
    rows = [
        _HEADER_MEINE_ORDNER,
        [2000.0, "Folder 2000", None, None, None, None, None, None],
        [None, "extra description line 1", None, None, None, None, None, None],
        [None, "extra description line 2", None, None, None, None, None, None],
        [None, None, "Item A", "keine", None, None, None, None],
    ]
    data = write_workbook({"Meine Ordner": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    container = parsed.containers[0]
    assert container.description == "extra description line 1\nextra description line 2"
    assert [item.content for item in container.items] == ["Item A"]


def test_ordner_eltern_uses_parents_owner_and_no_location(write_workbook):
    rows = [
        _HEADER_ORDNER_ELTERN,
        [3001.0, "Eltern Ordner 3001", None, None],
        [None, None, "Versicherungsschein", "hoch"],
    ]
    data = write_workbook({"Ordner Eltern": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    assert len(parsed.containers) == 1
    container = parsed.containers[0]
    assert container.owner == "parents"
    assert container.type == "folder"
    assert container.location is None
    assert len(container.items) == 1


def test_boxen_size_group_range_header_propagates(write_workbook):
    rows = [
        _HEADER_BOXEN,
        ["3000 bis 3099", "Sehr grosse Boxen", None, None, None, None],
        [3000.0, "Box 3000", None, None, None, None],
        [None, None, None, None, "Photo album", "Familie"],
        [3001.0, "Box 3001", None, None, None, None],
        [None, None, None, None, "Tax archive", "Steuern"],
    ]
    data = write_workbook({"Boxen": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    assert [c.external_id for c in parsed.containers] == [3000, 3001]
    assert all(c.type == "box" for c in parsed.containers)
    assert all(c.size_group == "3000 bis 3099" for c in parsed.containers)
    assert parsed.containers[0].items[0].content == "Photo album"


def test_unknown_priority_yields_warning_and_none_default(write_workbook):
    rows = [
        _HEADER_MEINE_ORDNER,
        [4000.0, "Folder 4000", None, None, None, None, None, None],
        [None, None, "Item with weird priority", "super hoch", None, None, None, None],
    ]
    data = write_workbook({"Meine Ordner": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    container = parsed.containers[0]
    assert container.items[0].priority == "none"
    assert any("super hoch" in w for w in parsed.warnings)


def test_unknown_category_segment_warns_but_still_produces_slug(write_workbook):
    rows = [
        _HEADER_MEINE_ORDNER,
        [5000.0, "Folder 5000", None, None, None, None, None, None],
        [None, None, "Item", "keine", "Finanzen/Schlumpfhausen", None, None, None],
    ]
    data = write_workbook({"Meine Ordner": rows})
    parsed = parse_workbook(__import__("io").BytesIO(data))

    assert parsed.containers[0].items[0].category_path == "finance/schlumpfhausen"
    assert any("Schlumpfhausen" in w for w in parsed.warnings)


def test_sheets_missing_yields_warning_no_crash(write_workbook):
    data = write_workbook({"Unrelated": [["whatever"]]})
    parsed = parse_workbook(__import__("io").BytesIO(data))
    assert parsed.containers == []
    assert any("Meine Ordner" in w for w in parsed.warnings)
