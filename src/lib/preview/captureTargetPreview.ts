/**
 * Drag-preview capture: SVG raster drops Tailwind on clones, so element pins use
 * canvas replicas driven by getComputedStyle (parent-first frame backgrounds).
 */

import {
  TARGET_PREVIEW_THUMB_DPR,
  TARGET_PREVIEW_THUMB_HEIGHT,
  TARGET_PREVIEW_THUMB_PADDING,
  TARGET_PREVIEW_THUMB_RENDER_HEIGHT,
  TARGET_PREVIEW_THUMB_RENDER_WIDTH,
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

/** Resolve visible background from computed backgroundColor or gradient image. */
export function pickCssBackgroundColor(
  backgroundColor: string | undefined,
  backgroundImage?: string
): string | undefined {
  if (isOpaqueCssColor(backgroundColor)) return backgroundColor!;
  return pickElementFillColor(undefined, backgroundImage);
}

/** True when the element is a border-only control with no fill. */
export function isOutlineControlStyle(style: {
  backgroundColor?: string;
  backgroundImage?: string;
  borderWidth?: string;
  borderColor?: string;
}): boolean {
  const fill = pickElementFillColor(style.backgroundColor, style.backgroundImage);
  const borderW = parseFloat(style.borderWidth ?? '0') || 0;
  return !fill && borderW > 0 && isOpaqueCssColor(style.borderColor);
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

/** Parse alpha channel from rgba()/rgb() colors (1 for opaque hex/named colors). */
export function backgroundColorAlpha(color: string | undefined | null): number {
  if (!color) return 0;
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)') {
    return 0;
  }
  const rgba = c.match(
    /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (rgba) {
    return rgba[1] !== undefined ? parseFloat(rgba[1]) : 1;
  }
  return 1;
}

/** True when a computed color is visible (not fully transparent). */
export function isOpaqueCssColor(color: string | undefined | null): boolean {
  return backgroundColorAlpha(color) > 0;
}

/** True when a solid background is visible enough to paint (ignores glass/5% fills). */
export function isMeaningfulBackgroundColor(color: string | undefined | null): boolean {
  return backgroundColorAlpha(color) >= 0.2;
}

/** Resolve fill color from computed style (background or gradient snippet). */
export function pickElementFillColor(
  backgroundColor: string | undefined,
  backgroundImage?: string
): string | undefined {
  if (isMeaningfulBackgroundColor(backgroundColor)) return backgroundColor!;
  const img = backgroundImage ?? '';
  if (!img || img === 'none') return undefined;
  const rgb = img.match(/rgb\([^)]+\)/);
  if (rgb?.[0]) return rgb[0];
  const hex = img.match(/#([0-9a-fA-F]{3,8})/);
  if (hex?.[0]) return hex[0];
  return undefined;
}

/** True when computed style has a solid or gradient background worth painting. */
export function hasVisibleBackground(style: {
  backgroundColor?: string;
  backgroundImage?: string;
}): boolean {
  return Boolean(
    pickElementFillColor(style.backgroundColor, style.backgroundImage) ||
      (style.backgroundImage && style.backgroundImage !== 'none')
  );
}

/**
 * Return the first style in the chain (element, parent, …) with a visible background.
 * Used by unit tests via style arrays; the bridge walks live DOM parents.
 */
export function resolveBackgroundFromChain(
  styles: Array<{ backgroundColor?: string; backgroundImage?: string }>
): { backgroundColor?: string; backgroundImage?: string } | null {
  for (const style of styles) {
    if (hasVisibleBackground(style)) return style;
  }
  return null;
}

export type SectionPreviewLayout = 'features_grid' | 'hero_split' | 'contact' | 'generic';

/** Extract color stops from a CSS linear-gradient background-image. */
export function parseLinearGradientStops(backgroundImage: string | undefined): string[] {
  if (!backgroundImage || backgroundImage === 'none') return [];
  const stops: string[] = [];
  const rgbMatches = backgroundImage.match(/rgb\([^)]+\)/gi);
  if (rgbMatches) stops.push(...rgbMatches);
  const hexMatches = backgroundImage.match(/#[0-9a-fA-F]{3,8}/g);
  if (hexMatches) stops.push(...hexMatches);
  return [...new Set(stops.map((s) => s.trim()))];
}

/** Parse CSS linear-gradient angle in degrees (default 90 = left-to-right). */
export function parseLinearGradientAngle(backgroundImage: string | undefined): number {
  if (!backgroundImage || backgroundImage === 'none') return 90;
  const match = backgroundImage.match(/linear-gradient\s*\(\s*([0-9.]+)deg/i);
  if (match?.[1]) {
    const deg = parseFloat(match[1]);
    if (Number.isFinite(deg)) return deg;
  }
  return 90;
}

/** Canvas gradient line endpoints for a CSS gradient angle. */
export function gradientLineForAngle(
  width: number,
  height: number,
  degrees: number
): { x0: number; y0: number; x1: number; y1: number } {
  const rad = (degrees * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.sqrt(width * width + height * height) / 2;
  const dx = Math.sin(rad) * len;
  const dy = -Math.cos(rad) * len;
  return { x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy };
}

/** Default section preview canvas sizes by layout. */
export const SECTION_PREVIEW_CANVAS_DEFAULTS: Record<
  SectionPreviewLayout,
  { width: number; height: number }
> = {
  features_grid: { width: 400, height: 220 },
  hero_split: { width: 400, height: 240 },
  contact: { width: 400, height: 240 },
  generic: { width: 380, height: 180 },
};

/** JavaScript capture helpers embedded in the preview iframe bridge. */
export function buildElementCaptureBridgeScript(): string {
  return `
function isOpaqueCssColor(color){
  if(!color)return false;
  var c=color.trim().toLowerCase();
  if(!c||c==="transparent"||c==="rgba(0, 0, 0, 0)"||c==="rgba(0,0,0,0)")return false;
  var rgba=c.match(/rgba?\\(\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*(?:,\\s*([\\d.]+)\\s*)?\\)/);
  if(rgba)return rgba[1]!==undefined?parseFloat(rgba[1]):1;
  return true;
}

function backgroundColorAlpha(color){
  if(!color)return 0;
  var c=color.trim().toLowerCase();
  if(!c||c==="transparent"||c==="rgba(0, 0, 0, 0)"||c==="rgba(0,0,0,0)")return 0;
  var rgba=c.match(/rgba?\\(\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*(?:,\\s*([\\d.]+)\\s*)?\\)/);
  if(rgba)return rgba[1]!==undefined?parseFloat(rgba[1]):1;
  return 1;
}

function isMeaningfulBackgroundColor(color){
  return backgroundColorAlpha(color)>=0.2;
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
  if(isMeaningfulBackgroundColor(style.backgroundColor))return style.backgroundColor;
  var img=style.backgroundImage||"";
  if(img&&img!=="none"){
    var rgb=img.match(/rgb\\([^)]+\\)/);
    if(rgb&&rgb[0])return rgb[0];
    var hex=img.match(/#([0-9a-fA-F]{3,8})/);
    if(hex&&hex[0])return hex[0];
  }
  return null;
}

function pickBackgroundFromStyle(style){
  return pickElementFillColor(style);
}

function styleHasVisibleBackground(style){
  if(style.backgroundImage&&style.backgroundImage!=="none")return true;
  return !!pickElementFillColor(style);
}

function resolveImmediateBackgroundStyle(el,elementStyle){
  if(elementStyle&&styleHasVisibleBackground(elementStyle))return elementStyle;
  var node=el.parentElement;
  var depth=0;
  while(node&&depth<8){
    var ps=window.getComputedStyle(node);
    if(styleHasVisibleBackground(ps))return ps;
    node=node.parentElement;
    depth++;
  }
  var section=el.closest&&el.closest("section,nav");
  if(section){
    var sectionStyle=window.getComputedStyle(section);
    if(styleHasVisibleBackground(sectionStyle))return sectionStyle;
  }
  return null;
}

function resolveChipBackgroundStyle(el){
  var style=window.getComputedStyle(el);
  if(isMeaningfulBackgroundColor(style.backgroundColor))return style;
  return resolveImmediateBackgroundStyle(el,null);
}

function fillRoundedRectWithStyle(ctx,x,y,w,h,radius,bgStyle,fallbackSolid){
  ctx.save();
  roundRect(ctx,x,y,w,h,radius);
  ctx.clip();
  if(bgStyle&&bgStyle.backgroundImage&&bgStyle.backgroundImage!=="none"){
    ctx.save();
    ctx.translate(x,y);
    paintCanvasBackground(ctx,w,h,bgStyle);
    ctx.restore();
  }else{
    ctx.fillStyle=(bgStyle&&pickElementFillColor(bgStyle))||fallbackSolid;
    ctx.fillRect(x,y,w,h);
  }
  ctx.restore();
}

function parseLinearGradientStops(backgroundImage){
  if(!backgroundImage||backgroundImage==="none")return [];
  var stops=[];
  var rgb=backgroundImage.match(/rgb\\([^)]+\\)/gi);
  if(rgb)for(var i=0;i<rgb.length;i++)stops.push(rgb[i]);
  var hex=backgroundImage.match(/#[0-9a-fA-F]{3,8}/g);
  if(hex)for(var j=0;j<hex.length;j++)stops.push(hex[j]);
  var seen={};
  var unique=[];
  for(var k=0;k<stops.length;k++){
    var s=stops[k].trim();
    if(!seen[s]){seen[s]=true;unique.push(s);}
  }
  return unique;
}

function parseLinearGradientAngle(backgroundImage){
  if(!backgroundImage||backgroundImage==="none")return 90;
  var match=backgroundImage.match(/linear-gradient\\s*\\(\\s*([0-9.]+)deg/i);
  if(match&&match[1]){
    var deg=parseFloat(match[1]);
    if(Number.isFinite(deg))return deg;
  }
  return 90;
}

function gradientLineForAngle(w,h,deg){
  var rad=deg*Math.PI/180;
  var cx=w/2,cy=h/2;
  var len=Math.sqrt(w*w+h*h)/2;
  var dx=Math.sin(rad)*len;
  var dy=-Math.cos(rad)*len;
  return {x0:cx-dx,y0:cy-dy,x1:cx+dx,y1:cy+dy};
}

function paintCanvasBackground(ctx,w,h,style){
  var stops=parseLinearGradientStops(style.backgroundImage);
  var solid=pickElementFillColor(style);
  if(stops.length>=2){
    var angle=parseLinearGradientAngle(style.backgroundImage);
    var line=gradientLineForAngle(w,h,angle);
    var grad=ctx.createLinearGradient(line.x0,line.y0,line.x1,line.y1);
    grad.addColorStop(0,stops[0]);
    grad.addColorStop(1,stops[stops.length-1]);
    ctx.fillStyle=grad;
  }else if(solid){
    ctx.fillStyle=solid;
  }else{
    ctx.fillStyle="#ffffff";
  }
  ctx.fillRect(0,0,w,h);
}

function resolveSectionComputedStyle(el){
  if(!el||!el.closest)return null;
  var section=el.closest("section")||el.closest("nav");
  if(section)return window.getComputedStyle(section);
  return null;
}

function paintElementBackdrop(ctx,el,outW,outH){
  if(!el||typeof el.closest!=="function"){
    ctx.fillStyle="#f4f4f5";
    ctx.fillRect(0,0,outW,outH);
    return;
  }
  var bgStyle=resolveImmediateBackgroundStyle(el,null);
  if(bgStyle){
    paintCanvasBackground(ctx,outW,outH,bgStyle);
    return;
  }
  ctx.fillStyle=resolvePreviewFrameBackground(el);
  ctx.fillRect(0,0,outW,outH);
}

function createScaledCanvas(outW,outH){
  var canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(outW*PREVIEW_THUMB_DPR));
  canvas.height=Math.max(1,Math.round(outH*PREVIEW_THUMB_DPR));
  var ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.scale(PREVIEW_THUMB_DPR,PREVIEW_THUMB_DPR);
  return {canvas:canvas,ctx:ctx};
}

function isOutlineControlStyle(style){
  var fill=pickElementFillColor(style);
  var borderW=parseFloat(style.borderWidth)||0;
  return !fill&&borderW>0&&isOpaqueCssColor(style.borderColor);
}

function resolvePreviewFrameBackground(el){
  if(!el||typeof el.closest!=="function")return "#f4f4f5";
  var node=el.parentElement;
  var depth=0;
  while(node&&depth<8){
    var bg=pickBackgroundFromStyle(window.getComputedStyle(node));
    if(bg)return bg;
    node=node.parentElement;
    depth++;
  }
  var section=el.closest("section")||el.closest("nav");
  if(section){
    var sbg=pickBackgroundFromStyle(window.getComputedStyle(section));
    if(sbg)return sbg;
  }
  return "#f4f4f5";
}

function resolveButtonFillColor(style){
  var fill=pickElementFillColor(style);
  if(fill)return fill;
  if(isOutlineControlStyle(style))return null;
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
var PREVIEW_THUMB_DPR=${TARGET_PREVIEW_THUMB_DPR};
var PREVIEW_THUMB_RENDER_W=${TARGET_PREVIEW_THUMB_RENDER_WIDTH};
var PREVIEW_THUMB_RENDER_H=${TARGET_PREVIEW_THUMB_RENDER_HEIGHT};

function thumbResult(canvas,usePng,sourceW,sourceH){
  var mime=usePng?"image/png":"image/jpeg";
  var quality=usePng?undefined:0.82;
  var w=Math.max(1,Math.round(sourceW||PREVIEW_THUMB_W));
  var h=Math.max(1,Math.round(sourceH||PREVIEW_THUMB_H));
  return {dataUrl:canvas.toDataURL(mime,quality),captureKind:"styled_fallback",width:w,height:h};
}

function captureCardStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var cardW=Math.min(Math.max(Math.round(rect.width)||80,72),220);
  var cardH=Math.min(Math.max(Math.round(rect.height)||60,48),200);
  var edgePad=8;
  var outW=cardW+edgePad*2;
  var outH=cardH+edgePad*2;
  var scaled=createScaledCanvas(outW,outH);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  paintElementBackdrop(ctx,el,outW,outH);
  roundRect(ctx,edgePad,edgePad,cardW,cardH,parseBorderRadiusPx(style.borderRadius,Math.min(cardH,32)));
  ctx.fillStyle=pickElementFillColor(style)||"#ffffff";
  ctx.fill();
  var borderW=parseFloat(style.borderWidth)||0;
  if(borderW>0&&isOpaqueCssColor(style.borderColor)){
    ctx.strokeStyle=style.borderColor;
    ctx.lineWidth=borderW;
    ctx.stroke();
  }
  var imgEl=el.querySelector("img");
  var textY=edgePad+6;
  if(imgEl){
    var imgH=Math.min(Math.round(cardH*0.4),32);
    ctx.fillStyle="rgba(15,23,42,0.08)";
    roundRect(ctx,edgePad+6,textY,cardW-12,imgH,6);
    ctx.fill();
    textY+=imgH+6;
  }
  var titleEl=el.querySelector("h3,[data-site-element-kind='item_title'],h2,p");
  var titleText=titleEl?(titleEl.textContent||"").trim():(el.textContent||"").trim();
  var titleStyle=titleEl?window.getComputedStyle(titleEl):style;
  ctx.fillStyle=isOpaqueCssColor(titleStyle.color)?titleStyle.color:"#111827";
  drawFittedWrapped(ctx,titleText,edgePad+6,textY,cardW-12,cardH-(textY-edgePad)-6,titleStyle,10);
  return thumbResult(scaled.canvas,true,outW,outH);
}

function captureTextStyledFallback(el,leafKind){
  if(!el||!el.getBoundingClientRect)return null;
  var style=window.getComputedStyle(el);
  var text=(el.textContent||"").trim().slice(0,120);
  if(!text)return null;
  var textRect=el.getBoundingClientRect();
  var isHeading=leafKind==="heading"||leafKind==="item_title"||/^H[1-4]$/.test(el.tagName||"");
  var contentW=Math.min(Math.max(Math.round(textRect.width)||80,60),260);
  var contentH=Math.min(Math.max(Math.round(textRect.height)||20,20),isHeading?48:72);
  var edgePad=6;
  var outW=contentW+edgePad*2;
  var outH=contentH+edgePad*2;
  var scaled=createScaledCanvas(outW,outH);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  var ownFill=pickElementFillColor(style);
  if(ownFill){
    paintCanvasBackground(ctx,outW,outH,style);
  }else{
    paintElementBackdrop(ctx,el,outW,outH);
  }
  ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:(isHeading?"#111827":"#334155");
  var prefer=Math.min(parseFloat(style.fontSize)||(isHeading?16:12),isHeading?13:10);
  if(text.length>28||leafKind==="body"||leafKind==="item_body"){
    drawFittedWrapped(ctx,text,edgePad,edgePad,contentW,contentH,style,prefer);
  }else{
    drawFittedLine(ctx,text,edgePad+contentW/2,edgePad+contentH/2,contentW-4,contentH-4,style,prefer,"center");
  }
  return thumbResult(scaled.canvas,true,outW,outH);
}

function captureBoxStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var boxW=Math.min(Math.max(Math.round(rect.width)||80,60),220);
  var boxH=Math.min(Math.max(Math.round(rect.height)||24,24),80);
  var edgePad=8;
  var outW=boxW+edgePad*2;
  var outH=boxH+edgePad*2;
  var scaled=createScaledCanvas(outW,outH);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  paintElementBackdrop(ctx,el,outW,outH);
  roundRect(ctx,edgePad,edgePad,boxW,boxH,parseBorderRadiusPx(style.borderRadius,boxH));
  ctx.fillStyle=pickElementFillColor(style)||"rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#18181b";
  drawFittedLine(ctx,el.textContent,edgePad+boxW/2,edgePad+boxH/2,boxW-8,boxH-4,style,10,"center");
  return thumbResult(scaled.canvas,true,outW,outH);
}

function findItemGridCards(sectionEl){
  if(!sectionEl)return [];
  var grid=sectionEl.querySelector("[data-site-container-kind='item_grid'],.grid");
  if(!grid)return [];
  var children=grid.children;
  var cards=[];
  for(var i=0;i<children.length;i++){
    var node=children[i];
    if(typeof hasCardClassHint==="function"&&hasCardClassHint(node))cards.push(node);
    else if(node.getAttribute&&node.getAttribute("data-site-element-kind")==="item_card")cards.push(node);
  }
  if(!cards.length){
    for(var j=0;j<Math.min(children.length,4);j++)cards.push(children[j]);
  }
  return cards;
}

function findHeroLeftColumn(sectionEl){
  if(!sectionEl)return null;
  var grid=sectionEl.querySelector(".grid");
  if(grid&&grid.firstElementChild)return grid.firstElementChild;
  var h1=sectionEl.querySelector("h1");
  if(h1&&h1.parentElement&&h1.parentElement!==sectionEl)return h1.parentElement;
  return sectionEl;
}

function findHeroPrimaryHeading(sectionEl){
  var left=findHeroLeftColumn(sectionEl);
  if(left){
    var h1=left.querySelector("h1");
    if(h1)return h1;
    var h2=left.querySelector("h2");
    if(h2)return h2;
  }
  return sectionEl.querySelector("h1")||sectionEl.querySelector("h2");
}

function isDescendantOf(node,ancestor){
  if(!node||!ancestor)return false;
  while(node){
    if(node===ancestor)return true;
    node=node.parentElement;
  }
  return false;
}

function detectSectionLayout(sectionEl){
  if(!sectionEl)return "generic";
  if(sectionEl.getAttribute("data-site-section-type")==="hero")return "hero_split";
  var cards=findItemGridCards(sectionEl);
  if(cards.length>=2)return "features_grid";
  if(typeof findRoundedCardIn==="function"&&findRoundedCardIn(sectionEl))return "hero_split";
  var contacts=sectionEl.querySelectorAll("[data-site-element-kind='contact_field']");
  if(contacts.length>=1)return "contact";
  return "generic";
}

function resolveSectionPreviewCanvasSize(sectionEl,layout){
  var sizes={features_grid:{w:400,h:220},hero_split:{w:400,h:240},contact:{w:400,h:240},generic:{w:380,h:180}};
  var d=sizes[layout]||sizes.generic;
  return {w:d.w,h:d.h};
}

function previewCardRadiusPx(styleRadius,cardH){
  var parsed=parseBorderRadiusPx(styleRadius,cardH);
  return Math.min(parsed,12,Math.max(4,cardH*0.2));
}

function findSectionSubtitle(sectionEl,h2){
  if(h2&&h2.nextElementSibling&&h2.nextElementSibling.tagName==="P")return h2.nextElementSibling;
  var header=sectionEl.querySelector(".text-center");
  if(header){
    var hp=header.querySelector("p");
    if(hp)return hp;
  }
  var ps=sectionEl.querySelectorAll("h2 ~ p");
  return ps.length?ps[0]:null;
}

function scaledTitleFontSize(style,preferred,max){
  var raw=parseFloat(style.fontSize);
  if(Number.isFinite(raw))return Math.min(Math.max(raw*0.55,preferred),max);
  return preferred;
}

function captureHeroSectionFallback(sectionEl){
  var size=resolveSectionPreviewCanvasSize(sectionEl,"hero_split");
  var w=size.w,h=size.h;
  var scaled=createScaledCanvas(w,h);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  var sectionStyle=window.getComputedStyle(sectionEl);
  paintCanvasBackground(ctx,w,h,sectionStyle);
  var leftCol=findHeroLeftColumn(sectionEl);
  var innerCard=typeof findRoundedCardIn==="function"?findRoundedCardIn(sectionEl):null;
  var heading=findHeroPrimaryHeading(sectionEl);
  var leftW=Math.round(w*0.52);
  var titleY=12;
  if(leftCol&&heading){
    var ps=leftCol.querySelectorAll("p");
    for(var ei=0;ei<ps.length;ei++){
      if(heading.compareDocumentPosition(ps[ei])&Node.DOCUMENT_POSITION_FOLLOWING){
        var eyebrow=ps[ei];
        var ebStyle=window.getComputedStyle(eyebrow);
        ctx.fillStyle=isOpaqueCssColor(ebStyle.color)?ebStyle.color:"#FB923C";
        drawFittedWrapped(ctx,(eyebrow.textContent||"").trim(),10,titleY,leftW-16,14,ebStyle,7);
        titleY+=16;
        break;
      }
    }
  }
  if(heading){
    var hStyle=window.getComputedStyle(heading);
    ctx.fillStyle=isOpaqueCssColor(hStyle.color)?hStyle.color:"#ffffff";
    var titleSize=scaledTitleFontSize(hStyle,14,18);
    drawFittedWrapped(ctx,(heading.textContent||"").trim(),10,titleY,leftW-16,Math.round(h*0.34),hStyle,titleSize);
    titleY+=Math.round(h*0.34)+4;
  }
  var sub=heading&&heading.nextElementSibling&&heading.nextElementSibling.tagName==="P"?heading.nextElementSibling:null;
  if(sub){
    var subStyle=window.getComputedStyle(sub);
    ctx.fillStyle=isOpaqueCssColor(subStyle.color)?subStyle.color:"rgba(255,255,255,0.85)";
    drawFittedWrapped(ctx,(sub.textContent||"").trim(),10,titleY,leftW-16,34,subStyle,8);
  }
  if(innerCard){
    var cardX=Math.round(w*0.54);
    var cardW=w-cardX-10;
    var cardH=h-20;
    ctx.fillStyle="rgba(255,255,255,0.96)";
    roundRect(ctx,cardX,10,cardW,cardH,14);
    ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.08)";
    ctx.stroke();
    var cardEyebrow=innerCard.querySelector("p");
    var cardHead=innerCard.querySelector("h2,h3");
    var cardBody=cardHead&&cardHead.nextElementSibling&&cardHead.nextElementSibling.tagName==="P"?cardHead.nextElementSibling:null;
    var cardY=18;
    if(cardEyebrow){
      ctx.fillStyle="#EA580C";
      ctx.font="bold 7px sans-serif";
      ctx.fillText((cardEyebrow.textContent||"").trim().slice(0,24),cardX+10,cardY+8);
      cardY+=14;
    }
    if(cardHead){
      ctx.fillStyle="#111827";
      drawFittedWrapped(ctx,(cardHead.textContent||"").trim(),cardX+10,cardY,cardW-20,22,{fontWeight:"700",fontFamily:"serif,sans-serif"},10);
      cardY+=24;
    }
    if(cardBody){
      ctx.fillStyle="#64748b";
      drawFittedWrapped(ctx,(cardBody.textContent||"").trim(),cardX+10,cardY,cardW-20,26,{fontFamily:"sans-serif"},8);
      cardY+=28;
    }
    var fields=innerCard.querySelectorAll("[data-site-element-kind='contact_field'],.rounded-2xl");
    for(var ri=0;ri<Math.min(fields.length,3);ri++){
      var field=fields[ri];
      var fStyle=window.getComputedStyle(field);
      ctx.fillStyle=pickElementFillColor(fStyle)||"rgba(15,23,42,0.06)";
      roundRect(ctx,cardX+10,cardY,cardW-20,16,6);
      ctx.fill();
      ctx.fillStyle=isOpaqueCssColor(fStyle.color)?fStyle.color:"#334155";
      ctx.font="8px sans-serif";
      ctx.fillText((field.textContent||"").trim().slice(0,32),cardX+14,cardY+11);
      cardY+=20;
    }
  }
  var btnNodes=leftCol?leftCol.querySelectorAll("a.rounded-full,a.inline-flex"):sectionEl.querySelectorAll('a[href="#contact"],a[href="#services"],a[href^="tel:"]');
  var btnY=h-34;
  var btnCount=0;
  for(var bi=0;bi<btnNodes.length&&btnCount<2;bi++){
    var btn=btnNodes[bi];
    if(innerCard&&isDescendantOf(btn,innerCard))continue;
    var btnStyle=window.getComputedStyle(btn);
    var btnText=(btn.textContent||"").trim().slice(0,22);
    if(!btnText)continue;
    var bx=10+btnCount*102;
    var fill=pickElementFillColor(btnStyle);
    var outline=isOutlineControlStyle(btnStyle);
    if(fill&&!outline){
      ctx.fillStyle=fill;
      roundRect(ctx,bx,btnY,94,16,8);
      ctx.fill();
      ctx.fillStyle=isOpaqueCssColor(btnStyle.color)?btnStyle.color:"#ffffff";
    }else{
      ctx.strokeStyle=isOpaqueCssColor(btnStyle.borderColor)?btnStyle.borderColor:"rgba(255,255,255,0.55)";
      ctx.lineWidth=1;
      roundRect(ctx,bx,btnY,94,16,8);
      ctx.stroke();
      ctx.fillStyle=isOpaqueCssColor(btnStyle.color)?btnStyle.color:"#ffffff";
    }
    ctx.font="7px sans-serif";
    ctx.fillText(btnText,bx+8,btnY+11);
    btnCount++;
  }
  return thumbResult(scaled.canvas,true,w,h);
}

function captureFeaturesGridSection(sectionEl,sectionStyle){
  var size=resolveSectionPreviewCanvasSize(sectionEl,"features_grid");
  var w=size.w,h=size.h;
  var scaled=createScaledCanvas(w,h);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  paintCanvasBackground(ctx,w,h,sectionStyle);
  var h2=sectionEl.querySelector("h2");
  var headerEnd=Math.round(h*0.32);
  var titleY=18;
  if(h2){
    var h2Style=window.getComputedStyle(h2);
    ctx.fillStyle=isOpaqueCssColor(h2Style.color)?h2Style.color:"#111827";
    var titleSize=scaledTitleFontSize(h2Style,18,22);
    drawFittedLine(ctx,(h2.textContent||"").trim(),w/2,titleY,w-32,24,h2Style,titleSize,"center");
    titleY+=Math.round(titleSize)+6;
  }
  var subtitle=findSectionSubtitle(sectionEl,h2);
  if(subtitle){
    var subStyle=window.getComputedStyle(subtitle);
    ctx.fillStyle=isOpaqueCssColor(subStyle.color)?subStyle.color:"#64748b";
    var subSize=scaledTitleFontSize(subStyle,11,13);
    drawFittedWrapped(ctx,(subtitle.textContent||"").trim(),w*0.08,titleY,w*0.84,headerEnd-titleY,subStyle,subSize);
    titleY=headerEnd;
  }else{
    titleY=Math.max(titleY+4,headerEnd-8);
  }
  var cards=findItemGridCards(sectionEl);
  var cardCount=Math.min(cards.length,3);
  var gap=10;
  var cardY=titleY+10;
  var cardH=Math.max(72,h-cardY-10);
  var cardW=Math.floor((w-gap*(cardCount+1))/Math.max(cardCount,1));
  for(var ci=0;ci<cardCount;ci++){
    var card=cards[ci];
    var cardStyle=window.getComputedStyle(card);
    var cx=gap+ci*(cardW+gap);
    roundRect(ctx,cx,cardY,cardW,cardH,previewCardRadiusPx(cardStyle.borderRadius,cardH));
    ctx.fillStyle=pickElementFillColor(cardStyle)||"#ffffff";
    ctx.fill();
    var textEl=card.querySelector("h3,p,[data-site-element-kind='item_title'],[data-site-element-kind='item_body']")||card;
    var textStyle=window.getComputedStyle(textEl);
    ctx.fillStyle=isOpaqueCssColor(textStyle.color)?textStyle.color:"#111827";
    drawFittedWrapped(ctx,(textEl.textContent||"").trim(),cx+8,cardY+10,cardW-16,cardH-16,textStyle,11);
  }
  return thumbResult(scaled.canvas,true,w,h);
}

function captureGenericSection(sectionEl,sectionStyle){
  var size=resolveSectionPreviewCanvasSize(sectionEl,"generic");
  var w=size.w,h=size.h;
  var scaled=createScaledCanvas(w,h);
  if(!scaled)return null;
  var ctx=scaled.ctx;
  paintCanvasBackground(ctx,w,h,sectionStyle);
  var h2=sectionEl.querySelector("h2,h1");
  var body=sectionEl.querySelector("p");
  var y=24;
  if(h2){
    var h2Style=window.getComputedStyle(h2);
    ctx.fillStyle=isOpaqueCssColor(h2Style.color)?h2Style.color:"#111827";
    var titleSize=scaledTitleFontSize(h2Style,18,22);
    drawFittedLine(ctx,(h2.textContent||"").trim(),w/2,y,w-32,28,h2Style,titleSize,"center");
    y+=Math.round(titleSize)+8;
  }
  if(body){
    var bodyStyle=window.getComputedStyle(body);
    ctx.fillStyle=isOpaqueCssColor(bodyStyle.color)?bodyStyle.color:"#64748b";
    drawFittedWrapped(ctx,(body.textContent||"").trim(),20,y,w-40,h-y-16,bodyStyle,12);
  }
  return thumbResult(scaled.canvas,true,w,h);
}

function captureSectionStyledPreview(sectionEl){
  if(!sectionEl||!isSectionElement(sectionEl))return null;
  var sectionStyle=window.getComputedStyle(sectionEl);
  var layout=detectSectionLayout(sectionEl);
  if(layout==="features_grid")return captureFeaturesGridSection(sectionEl,sectionStyle);
  if(layout==="hero_split"||layout==="contact")return captureHeroSectionFallback(sectionEl);
  return captureGenericSection(sectionEl,sectionStyle);
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

function measureButtonPaintSize(el,style,rect){
  var rectW=Math.max(Math.round(rect.width)||0,0);
  var rectH=Math.max(Math.round(rect.height)||0,20);
  var padL=parseFloat(style.paddingLeft)||0;
  var padR=parseFloat(style.paddingRight)||0;
  var borderL=parseFloat(style.borderLeftWidth)||0;
  var borderR=parseFloat(style.borderRightWidth)||0;
  var label=(el.textContent||"").trim();
  var probe=document.createElement("canvas").getContext("2d");
  var contentW=rectW;
  if(probe&&label){
    probe.font=(style.fontWeight||"400")+" "+(style.fontSize||"14px")+" "+(style.fontFamily||"system-ui,sans-serif");
    contentW=Math.ceil(probe.measureText(label).width+padL+padR+borderL+borderR);
  }
  var btnW=rectW>0&&contentW>0&&rectW>contentW*1.25?contentW:rectW;
  btnW=Math.min(Math.max(btnW||contentW||72,72),280);
  var btnH=Math.min(Math.max(rectH,20),48);
  return {btnW:btnW,btnH:btnH};
}

function drawFittedLine(ctx,text,cx,cy,maxW,maxH,style,preferred,align){
  var label=(text||"").trim().slice(0,80);
  if(!label)return;
  var size=fitFontSize(ctx,label,maxW,maxH,preferred,style);
  ctx.font=(style.fontWeight||"400")+" "+size+"px "+(style.fontFamily||"system-ui,sans-serif");
  ctx.textAlign=align||"center";
  ctx.textBaseline="middle";
  ctx.fillText(label,cx,cy);
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
      ctx.fillText(line,x,lineY);
      line=words[i];
      lineY+=lineH;
      if(lineY>y+maxH-lineH)break;
    }else line=test;
  }
  if(line&&lineY<=y+maxH-lineH)ctx.fillText(line,x,lineY);
}

function captureButtonStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var measured=measureButtonPaintSize(el,style,rect);
  var btnW=measured.btnW;
  var btnH=measured.btnH;
  var contextPad=10;
  var outW=btnW+contextPad*2;
  var outH=btnH+contextPad*2;
  var canvas=document.createElement("canvas");
  canvas.width=outW*PREVIEW_THUMB_DPR;
  canvas.height=outH*PREVIEW_THUMB_DPR;
  var ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.scale(PREVIEW_THUMB_DPR,PREVIEW_THUMB_DPR);
  paintElementBackdrop(ctx,el,outW,outH);
  roundRect(ctx,contextPad,contextPad,btnW,btnH,parseBorderRadiusPx(style.borderRadius,btnH));
  var fill=resolveButtonFillColor(style);
  if(fill){
    ctx.fillStyle=fill;
    ctx.fill();
  }
  var borderW=parseFloat(style.borderWidth)||0;
  if(borderW>0&&isOpaqueCssColor(style.borderColor)){
    ctx.strokeStyle=style.borderColor;
    ctx.lineWidth=Math.max(1,borderW);
    ctx.stroke();
  }
  ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#ffffff";
  drawFittedLine(ctx,el.textContent,contextPad+btnW/2,contextPad+btnH/2,btnW-10,btnH-6,style,Math.min(parseFloat(style.fontSize)||14,14),"center");
  return thumbResult(canvas,true,outW,outH);
}

function captureChipStyledFallback(el){
  if(!el||!el.getBoundingClientRect)return null;
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var domW=Math.max(Math.round(rect.width)||0,80);
  var domH=Math.max(Math.round(rect.height)||0,24);
  var chipW=Math.min(domW,280);
  var chipH=Math.min(Math.max(domH,24),40);
  var edgePad=2;
  var outW=chipW+edgePad*2;
  var outH=chipH+edgePad*2;
  var canvas=document.createElement("canvas");
  canvas.width=outW*PREVIEW_THUMB_DPR;
  canvas.height=outH*PREVIEW_THUMB_DPR;
  var ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.scale(PREVIEW_THUMB_DPR,PREVIEW_THUMB_DPR);
  var radius=parseBorderRadiusPx(style.borderRadius,chipH);
  var bgStyle=resolveChipBackgroundStyle(el);
  fillRoundedRectWithStyle(ctx,edgePad,edgePad,chipW,chipH,radius,bgStyle,"rgb(37, 99, 235)");
  var borderW=parseFloat(style.borderWidth)||0;
  if(borderW>0&&isOpaqueCssColor(style.borderColor)){
    ctx.strokeStyle=style.borderColor;
    ctx.lineWidth=Math.max(1,borderW);
    roundRect(ctx,edgePad,edgePad,chipW,chipH,radius);
    ctx.stroke();
  }
  ctx.fillStyle=isOpaqueCssColor(style.color)?style.color:"#334155";
  drawFittedLine(ctx,el.textContent,edgePad+chipW/2,edgePad+chipH/2,chipW-12,chipH-6,style,11,"center");
  return thumbResult(canvas,true,chipW,chipH);
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
