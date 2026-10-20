// Shared by the storefront product modal (client) and the /products/[slug] page (server),
// so it takes ready-made strings and uses no hooks.
export { ProductGallery } from "./ProductGallery";

export function ProductDetails({
  description,
  highlights,
  specs,
  t,
}: {
  description: string | null;
  highlights: string[];
  specs: { label: string; value: string }[];
  t: (de: string, en: string) => string;
}) {
  return (
    <div className="pd">
      {highlights.length > 0 && (
        <section>
          <h4>{t("Auf einen Blick", "About this item")}</h4>
          <ul className="pd-bullets">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}
      {description && (
        <section>
          <h4>{t("Beschreibung", "Description")}</h4>
          <p>{description}</p>
        </section>
      )}
      {specs.length > 0 && (
        <section>
          <h4>{t("Produktdetails", "Product details")}</h4>
          <table className="pd-specs">
            <tbody>
              {specs.map((s) => (
                <tr key={s.label}>
                  <th scope="row">{s.label}</th>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
