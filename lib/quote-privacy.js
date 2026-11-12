// Only sales specifications and selling prices leave the server for non-admin users.
const privateFields=new Set(['piece_weight','pieces','density','materialCosts','material_cost','production_cost','unit_cost','cost_per_kg','cost_price','margin','profit_margin','waste','cost_breakdown']);
export function salesView(value){
  if(Array.isArray(value))return value.map(salesView);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!privateFields.has(key)).map(([k,v])=>[k,salesView(v)]));
}
export function withPieceEstimates(record){
  const result={...record};
  if(Array.isArray(result.items))result.items=result.items.map(withPieceEstimates);
  const source=result.items?.[0]||result;
  const unit=source.size_unit==='mm'?1000:100;
  const material=String(source.material||'').toUpperCase();
  const density=material.includes('HD')?0.95:material.includes('LD')?0.92:material.includes('PP')?0.90:0.93;
  const grams=(source.width/unit)*(source.length/unit)*Number(source.thickness)*(source.thickness_unit==='mm'?1000:1)*density;
  if(grams>0&&Number.isFinite(grams)){
    result.piece_weight ||= grams.toFixed(2)+' جرام';
    if(Number(source.total_kg)>0)result.pieces ||= Math.floor(source.total_kg*1000/grams).toLocaleString('ar-SA')+' حبة';
  }
  return result;
}

export function mergeSalesEdit(input,previous){
  const clean=salesView(input);
  if(previous){
    for(const key of privateFields){
      if(key!=='pieces'&&key!=='piece_weight'&&Object.hasOwn(previous,key))clean[key]=previous[key];
    }
    const matches=['product','material','width','length','thickness','size_unit','thickness_unit','total_kg'].every(k=>String(clean[k]??'')===String(previous[k]??''));
    if(matches)for(const key of ['pieces','piece_weight'])if(previous[key])clean[key]=previous[key];
  }
  if(Array.isArray(clean.items))clean.items=clean.items.map((item,i)=>mergeSalesEdit(item,previous?.items?.[i]));
  return withPieceEstimates(clean);
}
