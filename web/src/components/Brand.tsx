import { Layers3 } from 'lucide-react';

export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return <div className={`brand ${inverse ? 'brand--inverse' : ''}`}><span className="brand-symbol"><Layers3 size={28}/></span><span className="brand-type"><strong>Demandas<span>.</span></strong><small>Seu tempo, organizado</small></span></div>;
}
