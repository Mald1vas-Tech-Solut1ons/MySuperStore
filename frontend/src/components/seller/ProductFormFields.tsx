"use client";

import { useMemo } from "react";
import { DollarSign, Plus, Trash2, Package } from "lucide-react";
import {
  PACKAGE_PRESETS,
  ProductFormValues,
  specSuggestionsFor,
} from "@/lib/productForm";

export type CategoryOption = { id: string; name: string; slug: string; parent: string | null };

type Props = {
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  categories: CategoryOption[];
  stockLabel?: string;
  stockPlaceholder?: string;
};

const label = "text-xs font-semibold uppercase tracking-wider text-neutral-400";
const input =
  "w-full mt-1.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#E6B53C] outline-none";

// Categorias com filhas viram títulos de grupo; só as "folhas" são escolhíveis.
function groupCategories(categories: CategoryOption[]) {
  const byParent = new Map<string, CategoryOption[]>();
  categories.forEach((c) => {
    if (c.parent) byParent.set(c.parent, [...(byParent.get(c.parent) ?? []), c]);
  });
  const groups: { title: string; items: CategoryOption[] }[] = [];
  const loose: CategoryOption[] = [];
  categories
    .filter((c) => !c.parent)
    .forEach((root) => {
      const children = byParent.get(root.id);
      if (children?.length) groups.push({ title: root.name, items: children });
      else loose.push(root);
    });
  if (loose.length) groups.push({ title: groups.length ? "Outras categorias" : "Categorias", items: loose });
  return groups;
}

export function ProductFormFields({ values, onChange, categories, stockLabel = "Estoque", stockPlaceholder = "Ex: 10" }: Props) {
  const groups = useMemo(() => groupCategories(categories), [categories]);
  const selected = categories.find((c) => c.id === values.categoryId);
  const suggestions = specSuggestionsFor(selected?.slug).filter(
    (name) => !values.specs.some((s) => s.attribute_name.trim().toLowerCase() === name.toLowerCase()),
  );

  const pickCategory = (category: CategoryOption) => {
    const patch: Partial<ProductFormValues> = { categoryId: category.id };
    const preset = PACKAGE_PRESETS[category.slug];
    const hasPackage = values.weightG || values.length || values.width || values.height;
    // Só preenche a embalagem se ainda estiver vazia — nunca sobrescreve o que a lojista digitou.
    if (preset && !hasPackage) {
      patch.weightG = String(preset.weightG);
      patch.length = String(preset.length);
      patch.width = String(preset.width);
      patch.height = String(preset.height);
    }
    onChange(patch);
  };

  const setSpec = (index: number, field: "attribute_name" | "attribute_value", value: string) =>
    onChange({ specs: values.specs.map((s, i) => (i === index ? { ...s, [field]: value } : s)) });

  const addSpec = (name = "") =>
    onChange({ specs: [...values.specs, { attribute_name: name, attribute_value: "" }] });

  return (
    <div className="space-y-5">
      <div>
        <label className={label}>Nome do Produto</label>
        <input
          required
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={input}
          placeholder="Ex: Bolsa Boho de macramê cru"
        />
      </div>

      <div>
        <label className={label}>Categoria</label>
        <div className="mt-2 space-y-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] text-neutral-500 mb-1.5">{group.title}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.title}>
                {group.items.map((c) => {
                  const active = c.id === values.categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickCategory(c)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                        active
                          ? "bg-[#E6B53C] border-[#E6B53C] text-black"
                          : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-xs text-neutral-500 italic">Carregando categorias...</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Preço (R$)</label>
          <div className="relative mt-1.5">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={values.basePrice}
              onChange={(e) => onChange({ basePrice: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#E6B53C] outline-none font-mono"
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className={label}>{stockLabel}</label>
          <input
            type="number"
            min="0"
            value={values.stock}
            onChange={(e) => onChange({ stock: e.target.value })}
            className={`${input} font-mono`}
            placeholder={stockPlaceholder}
          />
        </div>
      </div>

      <div>
        <label className={label}>Descrição</label>
        <textarea
          rows={4}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={`${input} resize-none`}
          placeholder="Conte como a peça é feita, o fio usado, para quem combina, diferenciais..."
        />
      </div>

      <div>
        <label className={`${label} mb-2 flex justify-between items-center`}>
          Características da peça
          <button type="button" onClick={() => addSpec()} className="text-[#E6B53C] hover:text-[#B38F25] flex items-center gap-1 normal-case tracking-normal">
            <Plus className="w-3 h-3" /> Adicionar campo
          </button>
        </label>
        <div className="space-y-2 mt-1.5">
          {values.specs.map((s, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={s.attribute_name}
                onChange={(e) => setSpec(idx, "attribute_name", e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#E6B53C] outline-none"
                placeholder="Ex: Material"
              />
              <input
                value={s.attribute_value}
                onChange={(e) => setSpec(idx, "attribute_value", e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#E6B53C] outline-none"
                placeholder="Ex: Fio de algodão cru"
              />
              <button
                type="button"
                aria-label="Remover característica"
                onClick={() => onChange({ specs: values.specs.filter((_, i) => i !== idx) })}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-neutral-500 mr-1 self-center">Sugestões:</span>
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addSpec(name)}
                  className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10"
                >
                  + {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <Package className="w-4 h-4 text-[#E6B53C]" /> Embalagem e envio
        </p>
        <p className="text-xs text-neutral-500 mt-1 mb-3">
          Peso e medidas da peça já embalada. Entram no cálculo do frete — sem eles usamos o mínimo
          (300 g, 16×11×2 cm) e o frete pode ficar abaixo do real.
          {selected && PACKAGE_PRESETS[selected.slug] ? " Os valores sugeridos são uma estimativa: ajuste depois de pesar e medir." : ""}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          {(
            [
              ["weightG", "Peso (g)", "Ex: 500", "1"],
              ["length", "Compr. (cm)", "Ex: 30", "0.1"],
              ["width", "Largura (cm)", "Ex: 25", "0.1"],
              ["height", "Altura (cm)", "Ex: 12", "0.1"],
            ] as const
          ).map(([key, text, placeholder, step]) => (
            <div key={key}>
              <label className={label}>{text}</label>
              <input
                type="number"
                min="0"
                step={step}
                value={values[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                className="w-full mt-1.5 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#E6B53C] outline-none font-mono text-sm"
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 max-w-[14rem]">
          <label className={label}>Prazo de preparo (dias)</label>
          <input
            type="number"
            min="1"
            value={values.deliveryDays}
            onChange={(e) => onChange({ deliveryDays: e.target.value })}
            className="w-full mt-1.5 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#E6B53C] outline-none font-mono text-sm"
            placeholder="Padrão: 5"
          />
        </div>
      </div>
    </div>
  );
}
