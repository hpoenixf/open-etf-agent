// Fixed, app-owned artwork. No user content, CSS or external resources.
export const brandViewBox='0 0 64 64';
export const brandPaths=[
 {d:'M16 4H48Q60 4 60 16V48Q60 60 48 60H16Q4 60 4 48V16Q4 4 16 4Z',fill:'#173A33'},
 {d:'M25 18H20L15 23V41L20 46H25M39 18H44L49 23V41L44 46H39',stroke:'#81E4B5',width:3.4},
 {d:'M23 37L29 30L35 34L42 24M37 24H42V29',stroke:'#F1FFF7',width:3.8},
];
export function drawBrandMark(context,Path,x,y,size){
 context.save();context.translate(x,y);context.scale(size/64,size/64);
 context.lineCap='round';context.lineJoin='round';
 for(const {d,fill,stroke,width} of brandPaths){
  const path=new Path(d);
  if(fill){context.fillStyle=fill;context.fill(path);}
  else{context.strokeStyle=stroke;context.lineWidth=width;context.stroke(path);}
 }
 context.restore();
}
