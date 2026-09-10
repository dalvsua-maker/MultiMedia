import type { ResultadoBusqueda, TipoBusqueda } from "@/application/dtos/BusquedaDto";

export interface IExternalSearchService {
  search(tipo: TipoBusqueda, q: string): Promise<ResultadoBusqueda[]>;
}
