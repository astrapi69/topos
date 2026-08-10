from __future__ import annotations

from io import BytesIO

import openpyxl
from app.models import Action, Category, Container, ContainerType, Item, Owner, Priority

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
    assert parsed.containers[0].items[0].action_texts == ["Prüfen"]


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
        assert wb.sheetnames == ["Meine Ordner", "Ordner Eltern", "Boxen"]
        assert wb["Boxen"]["A2"].value == "100 bis 199"
        assert wb["Boxen"]["A3"].value == 100
    finally:
        wb.close()
