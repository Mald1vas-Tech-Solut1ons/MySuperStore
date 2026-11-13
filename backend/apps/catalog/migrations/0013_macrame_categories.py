from django.db import migrations

from apps.catalog.macrame import ensure_macrame_categories


def criar_categorias_macrame(apps, schema_editor):
    ensure_macrame_categories(apps.get_model("catalog", "Category"))


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0012_product_is_boosted"),
    ]

    operations = [
        # Aditiva e idempotente; não há o que desfazer (as categorias podem já ter produtos).
        migrations.RunPython(criar_categorias_macrame, migrations.RunPython.noop),
    ]
