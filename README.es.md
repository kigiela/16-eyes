# 16 Eyes

Auditorías de seguridad de todo el repositorio para [Claude Code](https://claude.com/claude-code).
Dieciséis ojos independientes revisan cada hallazgo antes de que llegue a tu informe: la
lente que lo encontró, un verificador escéptico que relee el código real, y — para los
hallazgos de alto impacto — varios revisores adversariales que intentan activamente
refutarlo. Nada llega al informe solo por la palabra de un agente.

*[Read in English](./README.md) · [Leia em português](./README.pt-BR.md)*

## Por qué existe

Las herramientas limitadas al diff (el `/security-review` nativo de Claude Code, la
mayoría de los escáneres conectados al CI) solo ven lo que cambió en el PR/rama actual.
Una vulnerabilidad que lleva meses intacta en el código es invisible para ellas. **16
Eyes escanea todo el repositorio**, sin importar qué cambió recientemente — un barrido
profundo, deliberado y ocasional, no algo para ejecutar en cada commit.

A diferencia de una lista de verificación fija, 16 Eyes **primero perfila tu
repositorio** (stack, dominios, arquitectura) y luego **diseña su propio plan de
investigación** — un servicio pequeño recibe un puñado de lentes a medida, un backend
grande y multi-dominio recibe muchas más — y en ambos casos las lentes tratan sobre lo
que *realmente existe* en tu código, no una lista genérica.

## Instalación

```bash
npx 16-eyes install
```

Se instala globalmente en `~/.claude/skills/user/16-eyes`. Usa `--project` para
instalarlo en `.claude/skills/16-eyes` del repositorio actual en su lugar. Se necesita
una sesión nueva de Claude Code después — los skills se descubren al inicio de la
sesión, no a mitad de ella.

```bash
npx 16-eyes update       # vuelve a copiar la última versión
npx 16-eyes uninstall    # elimina el skill (nunca toca el .16-eyes/ propio de un repo)
npx 16-eyes status       # muestra qué está instalado, y dónde
```

## Uso

Dentro de Claude Code, en cualquier repositorio:

```
/16-eyes init     configura — detecta gates de calidad, patrones de exclusión, ubicación de salida
/16-eyes audit    perfila el repo, diseña lentes a medida, ejecuta la auditoría
/16-eyes fix      aplica los hallazgos — los safe directamente, los risky con tu confirmación
```

`init` es opcional — `audit` y `fix` funcionan con valores por defecto razonables aunque
lo omitas. `audit` es de solo lectura y puede tardar unos minutos (decenas de llamadas a
subagentes) — es lo esperado para un barrido de todo el repositorio. `fix` nunca hace
commit ni push; siempre deja los cambios en tu working tree para que los revises.

## Cómo funciona

1. **Perfil** — un agente explora la estructura del repo e identifica su stack, dominio,
   y los subsistemas específicos que importan para la seguridad (pagos, webhooks, auth,
   subida de archivos, uso de LLM, lo que realmente aplique).
2. **Diseño de lentes** — un segundo agente, dado ese perfil, diseña una lista de lentes
   de investigación a medida — omitiendo categorías que no aplican, añadiendo las
   específicas del repo que sí aplican.
3. **Lentes → verificación** — cada lente investiga de forma independiente; cada
   hallazgo que plantea recibe una re-verificación escéptica independiente contra el
   código real (no solo la descripción del propio hallazgo).
4. **Revisión adversarial** — los hallazgos clasificados como de alto impacto pasan por
   una segunda ronda independiente: varios revisores intentan, cada uno, *refutar* el
   hallazgo. Solo sobrevive si la mayoría no logra refutarlo.
5. **Informe** — los hallazgos que sobreviven se clasifican como `safe` (corrección
   mecánica, sin cambio de comportamiento) o `risky` (requiere decisión humana),
   escritos tanto en un informe markdown (`SECURITY_AUDIT_<fecha>.md`) como en un
   complemento legible por máquina (`SECURITY_AUDIT_<fecha>.json`, consumido por
   `/16-eyes fix`).

## Licencia

MIT — ver [LICENSE](./LICENSE).
