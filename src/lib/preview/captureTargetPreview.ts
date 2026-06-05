/**
 * Drag-preview capture: SVG raster drops Tailwind on clones, so element pins use
 * canvas replicas driven by getComputedStyle (parent-first frame backgrounds).
 */

import {
  TARGET_PREVIEW_THUMB_HEIGHT,
  TARGET_PREVIEW_THUMB_PADDING,
  TARGET_PREVIEW_THUMB_WIDTH,
} from '@/lib/preview/targetPreviewThumbnail';

/** Element kinds that never use SVG foreignObject raster. */
export const STYLED_ELEMENT_CAPTURE_KINDS = new Set([
  'button',
  'contact_field',
  'heading',
  'body',
  'item_title',
  'item_body',
  'item_card',
  'image_caption',
  'panel',
]);

/** True when drag preview should use canvas replica instead of SVG raster. */
export function shouldPreferStyledElementCapture(
  leafKind: string | undefined,
  pinScope: string | undefined
): boolean {
  if (pinScope === 'element') return true;
  if (leafKind && STYLED_ELEMENT_CAPTURE_KINDS.has(leafKind)) return true;
  return false;
}

/** Whether this leaf should use the interactive button/CTA replica painter. */
export function shouldUseButtonStyledCapture(
  leafKind: string | undefined,
  tagName: string | undefined
): boolean {
  const tag = (tagName ?? '').toUpperCase();
  if (tag === 'A' || tag === 'BUTTON') return true;
  return leafKind === 'button';
}

/** Pick frame background from nearest ancestor colors (parent-first). */
export function pickPreviewFrameBackground(
  ancestorBackgrounds: Array<string | undefined | null>
): string {
  for (const bg of ancestorBackgrounds) {
    if (isOpaqueCssColor(bg)) return bg!;
  }
  return '#f4f4f5';
}

/** Parse CSS border-radius to a canvas corner radius (px). */
export function parseBorderRadiusPx(borderRadius: string, height: number): number {
  const trimmed = borderRadius.trim();
  if (!trimmed || trimmed === '0' || trimmed === '0px') return 4;
  if (trimmed.includes('%')) {
    const pct = parseFloat(trimmed);
    if (Number.isFinite(pct)) return Math.min((height * pct) / 100, height / 2);
  }
  const parts = trimmed.split(/\s+/).map((p) => parseFloat(p));
  const first = parts.find((n) => Number.isFinite(n));
  if (!first) return 4;
  if (first >= 9999 || first > height) return height / 2;
  return Math.min(first, height / 2);
}

/** True when a computed color is visible (not fully transparent). */
export function isOpaqueCssColor(color: string | undefined | null): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)') {
    return false;
  }
  return true;
}

/** Resolve fill color from computed style (background or gradient snippet). */
export function pickElementFillColor(
  backgroundColor: string | undefined,
  backgroundImage?: string
): string | undefined {
  if (isOpaqueCssColor(backgroundColor)) return backgroundColor!;
  const img = backgroundImage ?? '';
  if (!img || img === 'none') return undefined;
  const rgb = img.match(/rgb\([^)]+\)/);
  if (rgb?.[0]) return rgb[0];
  const hex = img.match(/#([0-9a-fA-F]{3,8})/);
  if (hex?.[0]) return hex[0];
  return undefined;
}

/** JavaScript capture helpers embedded in the preview iframe bridge. */
export function buildElementCaptureBridgeScript(): string {
  return `
function isOpaqueCssColor(color){
  if(!color)return false;
  var c=color.trim().toLowerCase();
  if(!c||c==="transparent"||c==="rgba(0, 0, 0, 0)"||c==="rgba(0,0,0,0)")return false;
  return true;
}

function parseBorderRadiusPx(borderRadius,height){
  var trimmed=(borderRadius||"").trim();
  if(!trimmed||trimmed==="0"||trimmed==="0px")return 4;
  if(trimmed.indexOf("%")>=0){
    var pct=parseFloat(trimmed);
    if(Number.isFinite(pct))return Math.min(height*pct/100,height/2);
  }
  var parts=trimmed.split(/\\s+/);
  var first=null;
  for(var i=0;i<parts.length;i++){
    var n=parseFloat(parts[i]);
    if(Number.isFinite(n)){first=n;break;}
  }
  if(first==null)return 4;
  if(first>=9999||first>height)return height/2;
  return Math.min(first,height/2);
}

function pickElementFillColor(style){
  if(isOpaqueCssColor(style.backgroundColor))return style.backgroundColor;
  var img=style.backgroundImage||"";
  if(img&&img!=="none"){
    var rgb=img.match(/rgb\\([^)]+\\)/);
    if(rgb&&rgb[0])return rgb[0];
    var hex=img.match(/#([0-9a-fA-F]{3,8})/);
    if(hex&&hex[0])return hex[0];
  }
  return null;
}

function resolvePreviewFrameBackground(el){
  var node=el.parentElement;
  var depth=0;
  while(node&&depth<8){
    var bg=window.getComputedStyle(node).backgroundColor;
    if(isOpaqueCssColor(bg))return bg;
    node=node.parentElement;
    depth++;
  }
  var section=el.closest("section")||el.closest("nav");
  if(section){
    var sbg=window.getComputedStyle(section).backgroundColor;
    if(isOpaqueCssColor(sbg))return sbg;
  }
  return "#f4f4f5";
}

function resolveButtonFillColor(style){
  var fill=pickElementFillColor(style);
  if(fill)return fill;
  return "#EA580C";
}

function shouldUseButtonStyledCapture(leafKind,tagName){
  var tag=(tagName||"").toUpperCase();
  if(tag==="A"||tag==="BUTTON")return true;
  return leafKind==="button";
}

function captureLeafKind(payload){
  var chain=payload&&payload.targetChain?payload.targetChain:[];
  var leaf=chain.length?chain[chain.length-1]:null;
  return leaf&&leaf.role==="element"?leaf.kind:null;
}

var PREVIEW_THUMB_PAD=${TARGET_PREVIEW_THUMB_PADDING};

function thumbResult(canvas){
  return {dataUrl:canvas.toDataURL("image/jpeg",0.82),captureKind:"styled_fallback",width:PREVIEW_THUMB_W,height:PREVIEW_THUMB_H};
}

function createThumbCanvas(el){
  var canvas=document.createElement("canvas");
  canvas.width=PREVIEW_THUMB_W;
  canvas.height=PREVIEW_THUMB_H;
  var ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.fillStyle=resolvePreviewFrameBackground(el);
  ctx.fillRect(0,0,PREVIEW_THUMB_W,PREVIEW_THUMB_H);
  return {canvas:canvas,ctx:ctx,pad:PREVIEW_THUMB_PAD,innerW:PREVIEW_THUMB_W-PREVIEW_THUMB_PAD*2,innerH:PREVIEW_THUMB_H-PREVIEW_THUMB_PAD*2};
}

function fitScaleToBox(srcW,srcH,maxW,maxH){
  var s=Math.min(maxW/Math.max(srcW,1),maxH/Math.max(srcH,1),1);
  return {w:Math.max(1,Math.round(srcW*s)),h:Math.max(1,Math.round(srcH*s)),scale:s};
}

function fitFontSize(ctx,text,maxW,maxH,preferred,style){
  var weight=style.fontWeight||"400";
  var family=style.fontFamily||"system-ui,sans-serif";
  var size=Math.min(preferred||12,maxH-2);
  for(var i=0;i<12;i++){
    ctx.font=weight+" "+size+"px "+family;
    if(ctx.measureText(text).width<=maxW&&size<=maxH)return size;
    size=Math.max(7,size-1);
  }
  return Math.max(7,size);
}

function drawFittedLine(ctx,text,cx,cy,maxW,maxH,style,preferred,align){
  var label=(text||"").trim().slice(0,80);
  if(!label)return;
  var size=fitFontSize(ctx,label,maxW,maxH,preferred,style);
  ctx.font=(style.fontWeight||"400")+" "+size+"px "+(style.fontFamily||"system-ui,sans-serif");
  ctx.textAlign=align||"center";
  ctx.textBaseline="middle";
  ctx.fillText(label,cx,cy,maxW);
}

function drawFittedWrapped(ctx,text,x,y,maxW,maxH,style,preferred){
  var words=(text||"").trim().slice(0,120).split(/\\s+/);
  if(!words.length)return;
  var size=fitFontSize(ctx,words.join(" "),maxW,maxH,preferred,style);
  ctx.font=(style.fontWeight||"400")+" "+size+"px "+(style.fontFamily||"system-ui,sans-serif");
  ctx.textAlign="left";
  ctx.textBaseline="top";
  var line="";
  var lineY=y;
  var lineH=size+2;
  for(var i=0;i<words.length;i++){
    var test=line?line+" "+words[i]:words[i];
    if(ctx.measureText(test).width>maxW&&line){
      ctx.fillText(line,x,lineY,maxW);
      line=words[i];
      lineY+=lineH;
      if(lineY>y+maxH-lineH)break;
    }else line=test;
  }
  if(line&&lineY<=y+maxH-lineH)ctx.fillText(line,x,lineY,maxW);
}

function captureButtonStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var thumb=createThumbCanvas(el);
  if(!thumb)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var fit=fitScaleToBox(Math.max(rect.width,40),Math.max(rect.height,20),thumb.innerW,thumb.innerH);
  var bx=thumb.pad+(thumb.innerW-fit.w)/2;
  var by=thumb.pad+(thumb.innerH-fit.h)/2;
  roundRect(thumb.ctx,bx,by,fit.w,fit.h,parseBorderRadiusPx(style.borderRadius,fit.h));
  thumb.ctx.fillStyle=resolveButtonFillColor(style);
  thumb.ctx.fill();
  var borderW=parseFloat(style.borderWidth)||0;
  if(borderW>0&&isOpaqueCssColor(style.borderColor)){
    thumb.ctx.strokeStyle=style.borderColor;
    thumb.ctx.lineWidth=Math.max(1,borderW*fit.scale);
    thumb.ctx.stroke();
  }
  thumb.ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#ffffff";
  drawFittedLine(thumb.ctx,el.textContent,bx+fit.w/2,by+fit.h/2,fit.w-8,fit.h-4,style,Math.min(parseFloat(style.fontSize)||13,13)*fit.scale+4,"center");
  return thumbResult(thumb.canvas);
}

function captureChipStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var thumb=createThumbCanvas(el);
  if(!thumb)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var fit=fitScaleToBox(Math.max(rect.width,60),Math.max(rect.height,24),thumb.innerW,thumb.innerH);
  var cx=thumb.pad+(thumb.innerW-fit.w)/2;
  var cy=thumb.pad+(thumb.innerH-fit.h)/2;
  roundRect(thumb.ctx,cx,cy,fit.w,fit.h,parseBorderRadiusPx(style.borderRadius,fit.h));
  thumb.ctx.fillStyle=pickElementFillColor(style)||"rgba(15,23,42,0.06)";
  thumb.ctx.fill();
  thumb.ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#334155";
  drawFittedLine(thumb.ctx,el.textContent,cx+fit.w/2,cy+fit.h/2,fit.w-8,fit.h-4,style,11,"center");
  return thumbResult(thumb.canvas);
}

function captureCardStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var thumb=createThumbCanvas(el);
  if(!thumb)return null;
  var style=window.getComputedStyle(el);
  var ix=thumb.pad,iy=thumb.pad,iw=thumb.innerW,ih=thumb.innerH;
  roundRect(thumb.ctx,ix,iy,iw,ih,parseBorderRadiusPx(style.borderRadius,Math.min(ih,32)));
  thumb.ctx.fillStyle=pickElementFillColor(style)||"#ffffff";
  thumb.ctx.fill();
  var borderW=parseFloat(style.borderWidth)||0;
  if(borderW>0&&isOpaqueCssColor(style.borderColor)){
    thumb.ctx.strokeStyle=style.borderColor;
    thumb.ctx.lineWidth=borderW;
    thumb.ctx.stroke();
  }
  var titleEl=el.querySelector("h3,[data-site-element-kind='item_title'],h2,p");
  var titleText=titleEl?(titleEl.textContent||"").trim():(el.textContent||"").trim();
  var titleStyle=titleEl?window.getComputedStyle(titleEl):style;
  thumb.ctx.fillStyle=isOpaqueCssColor(titleStyle.color)?titleStyle.color:"#111827";
  drawFittedWrapped(thumb.ctx,titleText,ix+6,iy+6,iw-12,ih-14,titleStyle,11);
  return thumbResult(thumb.canvas);
}

function captureTextStyledFallback(el,leafKind){
  if(!el||!el.getBoundingClientRect)return null;
  var thumb=createThumbCanvas(el);
  if(!thumb)return null;
  var style=window.getComputedStyle(el);
  var text=(el.textContent||"").trim().slice(0,120);
  if(!text)return null;
  var ownFill=pickElementFillColor(style);
  var isHeading=leafKind==="heading"||leafKind==="item_title"||/^H[1-4]$/.test(el.tagName||"");
  var ix=thumb.pad,iy=thumb.pad,iw=thumb.innerW,ih=thumb.innerH;
  if(ownFill){
    roundRect(thumb.ctx,ix,iy,iw,ih,parseBorderRadiusPx(style.borderRadius,ih));
    thumb.ctx.fillStyle=ownFill;
    thumb.ctx.fill();
  }
  thumb.ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:(isHeading?"#111827":"#334155");
  var prefer=Math.min(parseFloat(style.fontSize)||(isHeading?16:12),isHeading?12:10);
  drawFittedLine(thumb.ctx,text,ix+iw/2,iy+ih/2,iw-6,ih-6,style,prefer,"center");
  return thumbResult(thumb.canvas);
}

function captureBoxStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var thumb=createThumbCanvas(el);
  if(!thumb)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var fit=fitScaleToBox(Math.max(rect.width,40),Math.max(rect.height,20),thumb.innerW,thumb.innerH);
  var bx=thumb.pad+(thumb.innerW-fit.w)/2;
  var by=thumb.pad+(thumb.innerH-fit.h)/2;
  roundRect(thumb.ctx,bx,by,fit.w,fit.h,parseBorderRadiusPx(style.borderRadius,fit.h));
  thumb.ctx.fillStyle=pickElementFillColor(style)||"rgba(255,255,255,0.96)";
  thumb.ctx.fill();
  thumb.ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#18181b";
  drawFittedLine(thumb.ctx,el.textContent,bx+fit.w/2,by+fit.h/2,fit.w-8,fit.h-4,style,10,"center");
  return thumbResult(thumb.canvas);
}

function captureElementStyledPreview(el,leafKind){
  if(!el)return null;
  var tag=el.tagName?el.tagName.toUpperCase():"";
  if(shouldUseButtonStyledCapture(leafKind,tag))return captureButtonStyledFallback(el);
  if(leafKind==="contact_field")return captureChipStyledFallback(el);
  if(leafKind==="item_card"||leafKind==="panel")return captureCardStyledFallback(el);
  if(typeof hasCardClassHint==="function"&&hasCardClassHint(el))return captureCardStyledFallback(el);
  if(leafKind==="heading"||leafKind==="body"||leafKind==="item_title"||leafKind==="item_body"||leafKind==="image_caption"||/^H[1-4]$/.test(tag)||tag==="P"||tag==="FIGCAPTION")return captureTextStyledFallback(el,leafKind);
  return captureBoxStyledFallback(el);
}
`.trim();
}

/** @deprecated Use buildElementCaptureBridgeScript */
export function buildButtonCaptureBridgeScript(): string {
  return buildElementCaptureBridgeScript();
}
