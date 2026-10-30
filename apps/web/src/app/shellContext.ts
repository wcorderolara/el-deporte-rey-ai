export interface ShellContext {
  title: string;
  projectPath?: string;
  projectSection?: string;
  parent?: { label: string; to: string };
}

/** Presentation metadata derived from existing URLs; no project fetch or domain state is duplicated here. */
export function shellContext(pathname: string): ShellContext {
  if (pathname === '/') return { title: 'Inicio' };
  if (pathname === '/projects' || pathname === '/projects/') return { title: 'Mis proyectos' };
  if (pathname === '/projects/new' || pathname === '/projects/new/') {
    return { title: 'Crear contenido', parent: { label: 'Mis proyectos', to: '/projects' } };
  }
  const project = /^\/projects\/([^/]+)(\/.*)?$/.exec(pathname);
  if (project) {
    const suffix = project[2] ?? '';
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
    return { title, projectPath: `/projects/${project[1]}`, projectSection: title };
  }
  if (pathname === '/brand' || pathname === '/brand/') return { title: 'Marca y plantillas' };
  if (pathname === '/imports' || pathname === '/imports/') return { title: 'Datos' };
  if (pathname.startsWith('/imports/'))
    return { title: 'Detalle de datos', parent: { label: 'Datos', to: '/imports' } };
  return { title: 'Página no encontrada' };
}
