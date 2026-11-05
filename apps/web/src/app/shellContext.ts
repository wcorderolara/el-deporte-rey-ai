export interface ShellContext {
  title: string;
  hideHeaderTitle?: boolean;
  projectPath?: string;
  projectSection?: string;
  parent?: { label: string; to: string };
}

/** Presentation metadata derived from existing URLs; no project fetch or domain state is duplicated here. */
export function shellContext(pathname: string): ShellContext {
  if (pathname === '/') return { title: 'Inicio' };
  if (pathname === '/projects' || pathname === '/projects/') return { title: 'Mis proyectos' };
  if (pathname === '/projects/generate' || pathname === '/projects/generate/') {
    return { title: 'Crear contenido', parent: { label: 'Mis proyectos', to: '/projects' } };
  }
  if (/^\/projects\/batches\/[^/]+\/?$/.test(pathname)) {
    return { title: 'Resultado de la generación', parent: { label: 'Mis proyectos', to: '/projects' } };
  }
  if (pathname === '/exports' || pathname === '/exports/') {
    return { title: 'Exportaciones', parent: { label: 'Mis proyectos', to: '/' } };
  }
  const project = /^\/projects\/([^/]+)(\/.*)?$/.exec(pathname);
  if (project) {
    const suffix = project[2] ?? '';
    const isReview = /^\/review(?:\/|$)/.test(suffix);
    const title = suffix.includes('/facts')
      ? 'Datos y verificación'
      : suffix.includes('/review')
        ? 'Revisión del contenido'
        : suffix.includes('/trace')
          ? 'Trazabilidad'
          : suffix.includes('/exports/')
            ? 'Detalle de descarga'
            : suffix === '/exports'
              ? 'Descargas e historial'
              : 'Proyecto';
    return {
      title,
      projectPath: `/projects/${project[1]}`,
      projectSection: isReview ? undefined : title,
      hideHeaderTitle: isReview,
    };
  }
  if (pathname === '/brand' || pathname === '/brand/') return { title: 'Marca y plantillas' };
  if (pathname === '/imports' || pathname === '/imports/') return { title: 'Datos' };
  if (pathname === '/competitions' || pathname === '/competitions/') {
    return { title: 'Competiciones', parent: { label: 'Inicio', to: '/' } };
  }
  const season = /^\/competitions\/([^/]+)\/seasons\/[^/]+/.exec(pathname);
  if (season) {
    return { title: 'Temporada', parent: { label: 'Competición', to: `/competitions/${season[1]}` } };
  }
  if (pathname.startsWith('/competitions/')) {
    return { title: 'Competición', parent: { label: 'Competiciones', to: '/competitions' } };
  }
  if (pathname.startsWith('/imports/'))
    return { title: 'Detalle de datos', parent: { label: 'Datos', to: '/imports' } };
  return { title: 'Página no encontrada' };
}
