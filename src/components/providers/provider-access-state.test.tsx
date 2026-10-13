import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderAccessState } from "./provider-access-state";

describe("ProviderAccessState", () => {
  it("renders an explicit loading state", () => {
    const markup = renderToStaticMarkup(
      <ProviderAccessState loading error={null} authorized={false} />
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Verificando autorização");
  });

  it("renders session failures separately from denied access", () => {
    const errorMarkup = renderToStaticMarkup(
      <ProviderAccessState
        loading={false}
        error={new Error("session failure")}
        authorized={false}
      />
    );
    const deniedMarkup = renderToStaticMarkup(
      <ProviderAccessState loading={false} error={null} authorized={false} />
    );

    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain("Não foi possível verificar sua sessão");
    expect(deniedMarkup).toContain("Acesso não autorizado");
  });

  it("renders no access warning for an authorized session", () => {
    expect(
      renderToStaticMarkup(<ProviderAccessState loading={false} error={null} authorized />)
    ).toBe("");
  });
});
