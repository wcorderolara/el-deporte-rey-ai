import { Alert, Badge, Button, Card, EmptyState, IconButton, Input, LoadingState, Select, Textarea } from '../ui';

const swatches = [
  ['Purple', 'bg-brand-purple'],
  ['Deep purple', 'bg-brand-purple-deep'],
  ['Gold', 'bg-brand-gold'],
  ['Electric blue', 'bg-brand-blue'],
  ['Canvas', 'bg-surface-canvas'],
  ['Raised', 'bg-surface-raised'],
  ['Overlay', 'bg-surface-overlay'],
] as const;

export function DesignSystemPreview() {
  return (
    <main className="min-h-screen bg-surface-canvas p-gutter-mobile font-sans text-text-primary md:p-gutter-tablet lg:p-gutter-desktop">
      <div className="mx-auto grid max-w-content gap-8">
        <header className="grid gap-3 border-b border-border-subtle pb-6">
          <Badge tone="info">UI-01A · FOUNDATION</Badge>
          <h1 className="m-0 font-display text-heading-lg font-extrabold tracking-heading uppercase">
            El Deporte Rey AI
          </h1>
          <p className="m-0 max-w-reading text-body-lg text-text-secondary">
            Tokens semánticos y primitivas accesibles para el estudio creativo deportivo.
          </p>
        </header>

        <section className="grid gap-4" aria-labelledby="colors-title">
          <h2 id="colors-title" className="m-0 font-display text-heading-sm font-extrabold tracking-heading uppercase">
            Color y superficies
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {swatches.map(([label, color]) => (
              <Card key={label} padding="sm">
                <div className={`h-20 rounded-control border-hairline border-border-default ${color}`} />
                <p className="m-0 mt-2 text-body-sm text-text-secondary">{label}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4" aria-labelledby="actions-title">
          <h2 id="actions-title" className="m-0 font-display text-heading-sm font-extrabold tracking-heading uppercase">
            Acciones
          </h2>
          <Card className="flex flex-wrap items-center gap-3">
            <Button leadingIcon={<span aria-hidden="true">＋</span>}>Crear contenido</Button>
            <Button variant="secondary">Revisar contenido</Button>
            <Button variant="quiet">Cancelar</Button>
            <Button variant="danger">Retirar aprobación</Button>
            <Button isLoading loadingLabel="Generando contenido">
              Generar contenido
            </Button>
            <IconButton label="Cerrar panel">×</IconButton>
          </Card>
        </section>

        <section className="grid gap-4" aria-labelledby="badges-title">
          <h2 id="badges-title" className="m-0 font-display text-heading-sm font-extrabold tracking-heading uppercase">
            Estados
          </h2>
          <Card className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="info">Información</Badge>
            <Badge tone="success" symbol="✓">
              Verificado
            </Badge>
            <Badge tone="warning" symbol="!">
              Requiere atención
            </Badge>
            <Badge tone="danger" symbol="×">
              Bloqueado
            </Badge>
            <Badge tone="attested" symbol="✎">
              Declarado por operador
            </Badge>
            <Badge tone="demo">Datos de demostración</Badge>
          </Card>
        </section>

        <section className="grid gap-4" aria-labelledby="forms-title">
          <h2 id="forms-title" className="m-0 font-display text-heading-sm font-extrabold tracking-heading uppercase">
            Formularios
          </h2>
          <Card className="grid gap-5 md:grid-cols-2">
            <Input
              id="preview-headline"
              label="Titular"
              description="Máximo 80 caracteres."
              defaultValue="Noche de goles"
            />
            <Select id="preview-format" label="Formato" defaultValue="carousel">
              <option value="carousel">Carrusel · 4:5</option>
              <option value="story">Historia · Próximamente</option>
            </Select>
            <Textarea
              id="preview-summary"
              label="Texto de apoyo"
              description="Resume la historia deportiva."
              defaultValue="Una jornada decisiva llena de emoción."
              wrapperClassName="md:col-span-2"
            />
            <Input
              id="preview-error"
              label="Campo con error"
              error="Revisa este valor antes de continuar."
              wrapperClassName="md:col-span-2"
            />
          </Card>
        </section>

        <section className="grid gap-4" aria-labelledby="feedback-title">
          <h2
            id="feedback-title"
            className="m-0 font-display text-heading-sm font-extrabold tracking-heading uppercase"
          >
            Feedback
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Alert tone="info" title="Datos preparados">
              La información deportiva está lista para revisar.
            </Alert>
            <Alert tone="success" title="Contenido aprobado">
              Ya puedes descargar los archivos.
            </Alert>
            <Alert tone="warning" title="Verificación pendiente">
              Hay datos que requieren tu atención.
            </Alert>
            <Alert tone="danger" title="No se pudo generar">
              Conservamos el proyecto para que intentes nuevamente.
            </Alert>
          </div>
          <LoadingState layout="panel" label="Generando vistas previas" />
          <EmptyState
            title="Aún no hay proyectos"
            description="Crea tu primer carrusel a partir de resultados deportivos."
            icon="◇"
            action={<Button>Crear contenido</Button>}
          />
        </section>
      </div>
    </main>
  );
}
