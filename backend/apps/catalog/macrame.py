"""Árvore de categorias para peças de macramê.

Fonte única usada pela migração de dados, pelo comando ``seed_macrame_categories``
e pela seed de demonstração. Os slugs são globais (``Category.slug`` é único), então
os nomes aqui seguem os que a loja da casa já usa (bolsas, calcados, chapeus, casa).
"""

ROOT_NAME = "Peças de Macramê"
ROOT_SLUG = "pecas-de-macrame"
ROOT_DESCRIPTION = "Peças feitas à mão em macramê, nó a nó."

# (nome, slug, descrição) — a ordem aqui é a ordem de exibição.
CHILDREN = [
    ("Bolsas", "bolsas", "Bolsas, clutches e mochilas de macramê."),
    ("Calçados", "calcados", "Sandálias, chinelos e outros calçados de macramê."),
    ("Rasteirinhas", "rasteirinhas", "Rasteirinhas de macramê feitas à mão."),
    ("Moda Feminina", "moda-feminina", "Tops, cropped, saias, vestidos e coletes de macramê."),
    ("Moda Praia", "moda-praia", "Saídas de praia, biquínis, cangas e kaftans de macramê."),
    ("Chapéus", "chapeus", "Chapéus, viseiras e bonés de macramê."),
    ("Acessórios", "acessorios", "Colares, brincos, pulseiras, cintos e chaveiros de macramê."),
    ("Casa e Decoração", "casa", "Painéis, porta-vasos, cestos, tapetes e almofadas de macramê."),
]


def ensure_macrame_categories(category_model):
    """Cria (ou completa) a árvore de macramê. Idempotente e conservadora.

    - Categoria que já existe NÃO é renomeada nem reativada (o admin pode ter ajustado);
      só é reorganizada sob a raiz quando ainda estava solta (sem pai).
    - Aceita o modelo histórico de uma migração (``apps.get_model``) ou o modelo real.
    Devolve ``{slug: categoria}`` incluindo a raiz.
    """
    root, _ = category_model.objects.get_or_create(
        slug=ROOT_SLUG,
        defaults={"name": ROOT_NAME, "description": ROOT_DESCRIPTION, "is_active": True, "order": 0},
    )
    result = {ROOT_SLUG: root}
    for order, (name, slug, description) in enumerate(CHILDREN, start=1):
        category, created = category_model.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "parent": root,
                "is_active": True,
                "order": order,
            },
        )
        if not created and category.parent_id is None:
            category.parent = root
            category.save(update_fields=["parent"])
        result[slug] = category
    return result
