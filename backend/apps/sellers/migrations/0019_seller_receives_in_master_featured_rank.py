from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sellers", "0018_seller_presentation_video_alter_seller_video_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="seller",
            name="receives_in_master",
            field=models.BooleanField(
                default=False,
                help_text="Loja da casa: recebe direto na conta Efí master (sem split nem repasse).",
            ),
        ),
        migrations.AddField(
            model_name="seller",
            name="featured_rank",
            field=models.PositiveSmallIntegerField(
                blank=True, db_index=True, null=True,
                help_text="Destaque na home: 1 = loja principal, 2, 3… Vazio = sem destaque.",
            ),
        ),
    ]
