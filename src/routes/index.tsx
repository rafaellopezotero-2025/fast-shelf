import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Inicio — Gestión de Librería' },
    { name: 'description', content: 'Acceso a la gestión de librería, papelería y fotocopias.' },
    { property: 'og:title', content: 'Inicio — Gestión de Librería' },
    { property: 'og:description', content: 'Acceso a la gestión de librería, papelería y fotocopias.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/panel" });
  },
});
