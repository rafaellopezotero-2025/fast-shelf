<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Encargos: all money/stock changes go through SECURITY DEFINER RPCs (guardar/registrar_pago/cambiar_estado/cancelar/finalizar_encargo); stock available = stock_actual - stock_reservado. Why: atomic, concurrency-safe, no double counting in caja/ventas.
- New migrations must also be copied to supabase/migrations/ so scripts/init-local-db.sh applies them on the offline Ubuntu install.
- Contadores: copies are counted from detalle_ventas (excluding ventas linked to an encargo) plus encargo_trabajos, via comparar_contadores(); shift boundaries come from configuracion.turno_corte in Argentina time. Why: each job is counted once.
- Local deployments use the offline Vite mode and generated private-network configuration without editing managed clients; hosted preview keeps its original settings. Why: prevent cloud fallback and keep preview isolated from local credentials.
- Local database startup uses scripts/start-local.sh and only supabase/migrations in atomic transactions; images must be present before startup. Why: recoverable installation with no runtime downloads or duplicate migration sets.
