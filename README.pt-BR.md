# 16 Eyes

Auditoria de segurança do repositório inteiro para o [Claude Code](https://claude.com/claude-code).
Dezesseis olhos independentes olham cada achado antes dele chegar no seu relatório: a
lente que o encontrou, um verificador cético que relê o código de verdade, e — pros
achados de impacto alto — vários revisores adversariais tentando ativamente derrubar o
achado. Nada entra no relatório só na palavra de um agente.

*[Read in English](./README.md) · [Lee en español](./README.es.md)*

## Por que isso existe

Ferramentas escopadas a diff (o `/security-review` nativo do Claude Code, a maioria dos
scanners ligados no CI) só enxergam o que mudou no PR/branch atual. Uma vulnerabilidade
que está parada no código há meses é invisível pra elas. **O 16 Eyes varre o repositório
inteiro**, independente do que mudou recentemente — um sweep profundo, deliberado e
ocasional, não algo pra rodar a cada commit.

Diferente de uma checklist fixa, o 16 Eyes **perfila seu repo primeiro** (stack,
domínios, arquitetura) e só então **desenha o próprio plano de investigação** — um
serviço pequeno ganha um punhado de lentes sob medida, um backend grande e
multi-domínio ganha bem mais — e em ambos os casos as lentes são sobre o que
*realmente existe* no seu código, não uma lista genérica.

## Instalação

```bash
npx 16-eyes install
```

Instala globalmente em `~/.claude/skills/user/16-eyes`. Use `--project` pra instalar no
`.claude/skills/16-eyes` do repositório atual em vez disso. Uma sessão nova do Claude
Code é necessária depois — skills são descobertos no início da sessão, não no meio dela.

```bash
npx 16-eyes update       # recopia a versão mais recente
npx 16-eyes uninstall    # remove o skill (nunca toca no .16-eyes/ próprio de um repo)
npx 16-eyes status       # mostra o que está instalado, e onde
```

## Uso

Dentro do Claude Code, em qualquer repositório:

```
/16-eyes init     configura — detecta gates de qualidade, padrões de exclusão, local de saída
/16-eyes audit    perfila o repo, desenha lentes sob medida, roda a auditoria
/16-eyes fix      aplica os achados — os safe direto, os risky com sua confirmação
```

`init` é opcional — `audit` e `fix` funcionam com padrões sensatos mesmo sem ele.
`audit` é somente leitura e pode levar alguns minutos (dezenas de chamadas de
subagente) — esperado pra um sweep do repositório inteiro. `fix` nunca commita nem
dá push; sempre deixa as mudanças na working tree pra você revisar.

## Como funciona

1. **Perfil** — um agente explora a estrutura do repo e identifica a stack, o domínio,
   e os subsistemas específicos que importam pra segurança (pagamentos, webhooks,
   auth, upload de arquivo, uso de LLM, o que realmente se aplicar).
2. **Desenho de lentes** — um segundo agente, dado esse perfil, desenha uma lista de
   lentes de investigação sob medida — pulando categorias que não se aplicam,
   adicionando as específicas do repo que se aplicam.
3. **Lentes → verificação** — cada lente investiga de forma independente; todo achado
   que ela levanta passa por uma reverificação cética independente contra o código de
   verdade (não só a descrição do próprio achado).
4. **Revisão adversarial** — achados classificados como impacto alto passam por uma
   segunda rodada independente: vários revisores tentam, cada um, *derrubar* o achado.
   Só sobrevive se a maioria não conseguir refutar.
5. **Relatório** — os achados que sobrevivem são classificados `safe` (correção
   mecânica, sem mudança de comportamento) ou `risky` (precisa de decisão humana),
   escritos tanto como relatório markdown (`SECURITY_AUDIT_<data>.md`) quanto um
   companheiro legível por máquina (`SECURITY_AUDIT_<data>.json`, consumido pelo
   `/16-eyes fix`).

## Licença

MIT — ver [LICENSE](./LICENSE).
