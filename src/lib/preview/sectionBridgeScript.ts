/**
 * Preview iframe bridge script (served externally to avoid inline-script CSP blocks).
 */

import { buildUniversalBootstrapBridgeScript } from '@/lib/preview/bootstrapPreviewElements';
import { buildElementCaptureBridgeScript } from '@/lib/preview/captureTargetPreview';
import {
  buildDomBitmapCaptureBridgeScript,
  loadDomBitmapCaptureBundle,
} from '@/lib/preview/domBitmapCaptureBridge';
import {
  TARGET_PREVIEW_THUMB_DPR,
  TARGET_PREVIEW_THUMB_HEIGHT,
  TARGET_PREVIEW_THUMB_RENDER_HEIGHT,
  TARGET_PREVIEW_THUMB_RENDER_WIDTH,
  TARGET_PREVIEW_THUMB_WIDTH,
} from '@/lib/preview/targetPreviewThumbnail';

export const PREVIEW_SECTION_BRIDGE_VERSION = 54;

const HIGHLIGHT_CLASS = 'site-editor-section-highlight';
const HOVER_CLASS = 'site-editor-section-hover';
const DRAGGABLE_HOVER_CLASS = 'site-editor-draggable-hover';

/** CSS injected into proxied preview HTML alongside the external bridge script. */
export const PREVIEW_SECTION_SELECTION_STYLES = `<style id="preview-section-selection-styles">
.${HIGHLIGHT_CLASS},.${HOVER_CLASS}{outline:3px solid #2563eb!important;outline-offset:3px!important;box-shadow:0 0 0 1px #2563eb,inset 0 0 0 9999px rgba(59,130,246,0.28)!important}
.${DRAGGABLE_HOVER_CLASS}{outline:2px solid rgba(59,130,246,0.55)!important;outline-offset:2px!important}
.site-editor-preview-bridge section,.site-editor-preview-bridge section[id],.site-editor-preview-bridge [data-site-section-id],.site-editor-preview-bridge [data-analytics-id],.site-editor-preview-bridge [data-site-config-field-path],.site-editor-preview-bridge [data-site-element-kind='contact_field'],.site-editor-preview-bridge main a,.site-editor-preview-bridge main button,.site-editor-preview-bridge main h1,.site-editor-preview-bridge main h2,.site-editor-preview-bridge main h3,.site-editor-preview-bridge main p,.site-editor-preview-bridge nav a{cursor:grab!important}
.site-editor-preview-bridge.site-editor-dragging{opacity:0.97}
.site-editor-preview-bridge.site-editor-dragging .${DRAGGABLE_HOVER_CLASS}{outline:none!important}
.site-editor-preview-bridge.site-editor-dragging section,.site-editor-preview-bridge.site-editor-dragging section[id],.site-editor-preview-bridge.site-editor-dragging [data-site-section-id],.site-editor-preview-bridge.site-editor-dragging [data-analytics-id],.site-editor-preview-bridge.site-editor-dragging [data-site-config-field-path],.site-editor-preview-bridge.site-editor-dragging [data-site-element-kind='contact_field'],.site-editor-preview-bridge.site-editor-dragging main a,.site-editor-preview-bridge.site-editor-dragging main button,.site-editor-preview-bridge.site-editor-dragging main h1,.site-editor-preview-bridge.site-editor-dragging main h2,.site-editor-preview-bridge.site-editor-dragging main h3,.site-editor-preview-bridge.site-editor-dragging main p,.site-editor-preview-bridge.site-editor-dragging nav a{cursor:grabbing!important}
.site-editor-preview-bridge.site-editor-dragging .site-editor-drag-source{transform:scale(0.98);opacity:0.88;transition:transform 120ms ease-out,opacity 120ms ease-out}
.site-editor-preview-bridge [data-site-config-field-path]:active,.site-editor-preview-bridge [data-site-element-kind='contact_field']:active,.site-editor-preview-bridge main a:active,.site-editor-preview-bridge main button:active,.site-editor-preview-bridge nav a:active{cursor:grabbing!important}
</style>`;

/** JavaScript body for the preview section selection bridge (no script tags). */
export function buildSectionBridgeScriptBody(): string {
  const domCaptureBundle = loadDomBitmapCaptureBundle();
  return `${domCaptureBundle}
(function(){
var MSG={DRAG_START:"SITE_SECTION_DRAG_START",POINTER_DOWN:"SITE_SECTION_POINTER_DOWN",READY:"SITE_SECTION_BRIDGE_READY",HIGHLIGHT:"SITE_SECTION_HIGHLIGHT",FOCUS:"SITE_SECTION_FOCUS",DISMISS:"SITE_SECTION_DISMISS",CLEAR:"SITE_SECTION_CLEAR_SELECTION",PREVIEW_THUMB:"SITE_SECTION_PREVIEW_THUMB",PARENT_DRAG_START:"SITE_SECTION_PARENT_DRAG_START",DRAG_CANCEL:"SITE_SECTION_DRAG_CANCEL"};
var HIGHLIGHT="${HIGHLIGHT_CLASS}";
var HOVER="${HOVER_CLASS}";
var DRAG_THRESHOLD=6;
var PREVIEW_THUMB_W=${TARGET_PREVIEW_THUMB_WIDTH};
var PREVIEW_THUMB_H=${TARGET_PREVIEW_THUMB_HEIGHT};
var PREVIEW_THUMB_DPR=${TARGET_PREVIEW_THUMB_DPR};
var PREVIEW_THUMB_RENDER_W=${TARGET_PREVIEW_THUMB_RENDER_WIDTH};
var PREVIEW_THUMB_RENDER_H=${TARGET_PREVIEW_THUMB_RENDER_HEIGHT};
var DRAGGABLE_HOVER="${DRAGGABLE_HOVER_CLASS}";
var CAPTURE_CACHE_TTL=2000;
var captureCache={};
var hoverOutlineEl=null;
var selectedId=null;
var selectedHover=false;
var dragState=null;
var parentOrigin=window.location.origin;
document.documentElement.classList.add("site-editor-preview-bridge");

function allSections(){
  return Array.prototype.slice.call(document.querySelectorAll("main section, body > section, section[id], [data-site-section-id], section[data-analytics-id]"));
}

function findSectionEl(el){
  while(el&&el!==document.body){
    if(el.getAttribute&&el.getAttribute("data-site-section-id"))return el;
    if(el.tagName==="SECTION")return el;
    if(el.id&&/^(hero|services|about|features|faq|testimonials|contact|gallery)$/i.test(el.id))return el;
    el=el.parentElement;
  }
  return null;
}

function findSectionNode(sectionId){
  if(!sectionId)return null;
  return document.querySelector('[data-site-section-id="'+sectionId+'"]')||document.querySelector('[data-analytics-id="'+sectionId+'"]')||document.getElementById(sectionId);
}

function sectionIndexFromEl(sectionEl){
  var idxAttr=sectionEl.getAttribute("data-site-section-index");
  if(idxAttr!=null){
    var parsed=parseInt(idxAttr,10);
    if(Number.isFinite(parsed))return parsed;
  }
  return allSections().indexOf(sectionEl);
}

function surfaceIdFromFieldPath(fieldPath){
  return fieldPath.replace(/[\\[\\].]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
}

function setElementAttr(el,kind,label,fieldPath,itemIndex,surfaceId){
  if(!el||el.getAttribute("data-site-element-kind"))return;
  el.setAttribute("data-site-element-kind",kind);
  el.setAttribute("data-site-element-label",label);
  el.setAttribute("data-site-config-field-path",fieldPath);
  if(itemIndex!=null)el.setAttribute("data-site-item-index",String(itemIndex));
  if(fieldPath)el.setAttribute("data-site-surface-id",surfaceId||surfaceIdFromFieldPath(fieldPath));
}

function pushItemNode(chain,itemIndex){
  if(!Number.isFinite(itemIndex))return;
  var last=chain[chain.length-1];
  if(last&&last.role==="item"&&last.itemIndex===itemIndex)return;
  chain.push({role:"item",kind:"item",label:"Item "+(itemIndex+1),itemIndex:itemIndex,itemPosition:itemIndex+1});
}

function readElementChain(sectionEl,target){
  var chain=[];
  var nodes=[];
  var node=target;
  while(node&&node!==sectionEl){
    if(!node.getAttribute){node=node.parentElement;continue;}
    var elKind=node.getAttribute("data-site-element-kind");
    var containerKind=node.getAttribute("data-site-container-kind");
    if(elKind||containerKind)nodes.push(node);
    node=node.parentElement;
  }
  nodes.reverse();
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];
    var ck=n.getAttribute("data-site-container-kind");
    if(ck){
      chain.push({role:"container",kind:ck,label:n.getAttribute("data-site-container-label")||ck});
      continue;
    }
    var kind=n.getAttribute("data-site-element-kind");
    var itemIdx=n.getAttribute("data-site-item-index");
    var parsedIdx=itemIdx!=null?parseInt(itemIdx,10):undefined;
    var fp=n.getAttribute("data-site-config-field-path")||"";
    var sid=n.getAttribute("data-site-surface-id")||"";
    if(Number.isFinite(parsedIdx))pushItemNode(chain,parsedIdx);
    chain.push({
      role:"element",
      kind:kind,
      label:n.getAttribute("data-site-element-label")||"",
      fieldPath:fp||undefined,
      itemIndex:Number.isFinite(parsedIdx)?parsedIdx:undefined,
      itemPosition:Number.isFinite(parsedIdx)?parsedIdx+1:undefined,
      surfaceId:sid||undefined
    });
  }
  return chain;
}

function annotateItemCard(card,sectionIndex,itemIndex){
  if(!card)return;
  var titleEl=card.querySelector("h3")||card.querySelector("p.font-bold")||card.querySelector("h3,p");
  var titleText=titleEl?(titleEl.textContent||"").trim():"";
  var label=titleText||("Item "+(itemIndex+1));
  var titlePath="sections["+sectionIndex+"].items["+itemIndex+"].title";
  if(titleEl)setElementAttr(titleEl,"item_title",label,titlePath,itemIndex);
  if(!card.getAttribute("data-site-element-kind")){
    card.setAttribute("data-site-element-kind","item_card");
    card.setAttribute("data-site-element-label",label);
    card.setAttribute("data-site-config-field-path",titlePath);
    card.setAttribute("data-site-item-index",String(itemIndex));
    card.setAttribute("data-site-surface-id",surfaceIdFromFieldPath(titlePath));
  }
  var bodyEl=card.querySelector("p:not([data-site-element-kind])");
  if(bodyEl&&titleEl&&bodyEl!==titleEl){
    var bodyText=(bodyEl.textContent||"").trim();
    if(bodyText)setElementAttr(bodyEl,"item_body",bodyText,"sections["+sectionIndex+"].items["+itemIndex+"].description",itemIndex);
  }
}

function bootstrapItemCards(sectionEl,sectionIndex){
  var grid=sectionEl.querySelector("[data-site-container-kind='item_grid']");
  if(!grid){
    var grids=sectionEl.querySelectorAll(".grid");
    if(grids.length)grid=grids[grids.length-1];
  }
  if(grid&&!grid.getAttribute("data-site-container-kind")){
    grid.setAttribute("data-site-container-kind","item_grid");
    grid.setAttribute("data-site-container-label","Item cards");
  }
  if(grid){
    var gridCards=grid.children;
    for(var gi=0;gi<gridCards.length;gi++)annotateItemCard(gridCards[gi],sectionIndex,gi);
    return;
  }
  var cards=sectionEl.querySelectorAll("h3");
  for(var i=0;i<cards.length;i++){
    var titleEl=cards[i];
    if(titleEl.closest("h2"))continue;
    var card=closestRoundedCard(titleEl)||titleEl.parentElement;
    if(card)annotateItemCard(card,sectionIndex,i);
    else setElementAttr(titleEl,"item_title",(titleEl.textContent||"").trim()||"Item title","sections["+sectionIndex+"].items["+i+"].title",i);
  }
}

function expandItemGridTarget(sectionEl,target,chain,sectionIndex){
  if(!chain.length||!target||!Number.isFinite(sectionIndex))return chain;
  var hasItemElement=chain.some(function(n){
    return n.role==="element"&&(n.kind==="item_card"||n.kind==="item_title"||n.kind==="item_body");
  });
  if(hasItemElement)return chain;
  var last=chain[chain.length-1];
  var onlyGrid=chain.length===1&&last.role==="container"&&last.kind==="item_grid";
  if(!onlyGrid&&!(last.role==="container"&&last.kind==="item_grid"))return chain;
  var card=findItemCardWrapper(target,sectionEl);
  if(!card)return chain;
  var grid=card.parentElement;
  if(!grid||grid.getAttribute("data-site-container-kind")!=="item_grid")return chain;
  var itemIndex=-1;
  for(var ci=0;ci<grid.children.length;ci++){
    if(grid.children[ci]===card){itemIndex=ci;break;}
  }
  if(itemIndex<0)return chain;
  annotateItemCard(card,sectionIndex,itemIndex);
  var titleEl=card.querySelector("[data-site-element-kind='item_title'],[data-site-element-kind='item_card'],h3,p");
  var label=(titleEl&&(titleEl.getAttribute("data-site-element-label")||titleEl.textContent||"").trim())||("Item "+(itemIndex+1));
  var fp="sections["+sectionIndex+"].items["+itemIndex+"].title";
  var expanded=[
    {role:"item",kind:"item",label:"Item "+(itemIndex+1),itemIndex:itemIndex,itemPosition:itemIndex+1},
    {role:"element",kind:"item_card",label:label,fieldPath:fp,itemIndex:itemIndex,itemPosition:itemIndex+1,surfaceId:surfaceIdFromFieldPath(fp)}
  ];
  if(onlyGrid)return expanded;
  return chain.slice(0,-1).concat(expanded);
}

${buildUniversalBootstrapBridgeScript()}

function readPayload(el,target,rootType){
  rootType=rootType||"section";
  if(rootType==="nav"){
    var navChain=[{role:"section",kind:"nav",label:"Navigation"}];
    var navElements=target?readElementChain(el,target):[];
    if(!navElements.some(function(n){return n.role==="element"&&n.fieldPath;})){
      var navInferred=inferLeafTarget(el,target,-1);
      if(navInferred)navElements=[navInferred];
    }
    for(var nc=0;nc<navElements.length;nc++)navChain.push(navElements[nc]);
    var navLeaf=navChain.length>1?navChain[navChain.length-1]:null;
    var navBase={
      sectionId:"nav",
      analyticsId:"nav",
      sectionIndex:-1,
      sectionType:"nav",
      sectionTitle:"Navigation",
      kind:"section",
      targetChain:navChain,
      pinScope:navLeaf&&navLeaf.fieldPath?"element":"section"
    };
    if(navLeaf&&navLeaf.fieldPath){
      return Object.assign({},navBase,{
        elementKind:navLeaf.kind,
        elementLabel:navLeaf.label,
        fieldPath:navLeaf.fieldPath,
        itemIndex:navLeaf.itemIndex,
        surfaceId:navLeaf.surfaceId
      });
    }
    return navBase;
  }
  var id=el.getAttribute("data-site-section-id")||el.getAttribute("data-analytics-id")||el.id||"";
  var idx=sectionIndexFromEl(el);
  if(!Number.isFinite(idx))idx=-1;
  var type=el.getAttribute("data-site-section-type")||el.getAttribute("data-analytics-type")||el.id||"section";
  var title=el.getAttribute("data-site-section-title")||el.getAttribute("data-analytics-label")||el.id||type;
  if(id==="hero"||type==="hero"){idx=-1;type="hero";title=title||"Hero";}
  if(!id){id="section_"+idx+"_"+type;}
  var sectionLabel=title;
  var chain=[{role:"section",kind:type,label:sectionLabel}];
  var elementNodes=target?readElementChain(el,target):[];
  elementNodes=expandItemGridTarget(el,target,elementNodes,idx);
  if(!elementNodes.some(function(n){return n.role==="element"&&n.fieldPath;})){
    var inferred=inferLeafTarget(el,target,idx);
    if(inferred){
      var pinnedInnerCard=elementNodes.some(function(n){return n.role==="container"&&n.kind==="inner_card";});
      if(!(pinnedInnerCard&&(!inferred.fieldPath||inferred.kind==="item_card"))){
        elementNodes=elementNodes.concat([inferred]);
      }
    }
  }
  for(var c=0;c<elementNodes.length;c++)chain.push(elementNodes[c]);
  var leaf=chain.length>1?chain[chain.length-1]:null;
  var base={
    sectionId:id,
    analyticsId:id,
    sectionIndex:idx,
    sectionType:type,
    sectionTitle:title,
    kind:type==="hero"?"hero":"section",
    targetChain:chain,
    pinScope:leaf&&leaf.fieldPath?"element":"section"
  };
  if(leaf&&leaf.fieldPath){
    return Object.assign({},base,{
      elementKind:leaf.kind,
      elementLabel:leaf.label,
      fieldPath:leaf.fieldPath,
      itemIndex:leaf.itemIndex,
      surfaceId:leaf.surfaceId
    });
  }
  return base;
}

function hasCardClassHint(el){
  var cls=el.className||"";
  return (cls.indexOf("rounded-3xl")>=0||cls.indexOf("rounded-2xl")>=0||cls.indexOf("rounded-[2rem]")>=0)&&cls.indexOf("border")>=0;
}

function findRoundedCardIn(scope){
  if(!scope)return null;
  var marked=scope.querySelector("[data-site-container-kind='inner_card']");
  if(marked)return marked;
  var nodes=scope.querySelectorAll("div");
  for(var i=0;i<nodes.length;i++){
    if(hasCardClassHint(nodes[i]))return nodes[i];
  }
  return null;
}

function closestRoundedCard(el){
  var node=el;
  while(node){
    if(hasCardClassHint(node))return node;
    node=node.parentElement;
  }
  return null;
}

function findItemCardWrapper(el,sectionEl){
  var node=el;
  while(node&&node!==sectionEl){
    if(hasCardClassHint(node))return node;
    node=node.parentElement;
  }
  return null;
}

function findAnnotatedLeaf(el,sectionEl){
  var node=el;
  while(node&&node!==sectionEl){
    if(node.getAttribute&&node.getAttribute("data-site-element-kind"))return node;
    node=node.parentElement;
  }
  return null;
}

function isTinyElement(el){
  var rect=el.getBoundingClientRect();
  return rect.width<24||rect.height<16;
}

function resolveCaptureRoot(sectionEl,clickTarget,payload){
  var chain=payload&&payload.targetChain?payload.targetChain:[];
  var leaf=chain.length?chain[chain.length-1]:null;
  var leafKind=leaf&&leaf.role==="element"?leaf.kind:null;
  if((!payload||payload.pinScope!=="element")&&!(leaf&&leaf.fieldPath))return sectionEl;
  if(leafKind==="item_title"||leafKind==="item_body"||leafKind==="image_caption"||leafKind==="item_card"){
    var itemCard=findItemCardWrapper(clickTarget,sectionEl);
    if(itemCard)return itemCard;
    var cardLeaf=findAnnotatedLeaf(clickTarget,sectionEl);
    if(cardLeaf&&cardLeaf.getAttribute("data-site-element-kind")==="item_card")return cardLeaf;
  }
  var annotated=findAnnotatedLeaf(clickTarget,sectionEl)||clickTarget;
  if(isTinyElement(annotated)&&annotated.parentElement&&annotated.parentElement!==sectionEl)return annotated.parentElement;
  if(leafKind==="contact_field"||leafKind==="button"||leafKind==="heading"||leafKind==="body")return annotated;
  var card=findItemCardWrapper(clickTarget,sectionEl);
  if(card)return card;
  return annotated;
}

function wrapText(ctx,text,maxWidth,x,y){
  var words=(text||"").split(/\\s+/);
  var line="";
  var lineY=y;
  for(var i=0;i<words.length;i++){
    var test=line?line+" "+words[i]:words[i];
    if(ctx.measureText(test).width>maxWidth&&line){
      ctx.fillText(line,x,lineY);
      line=words[i];
      lineY+=18;
    }else line=test;
  }
  if(line)ctx.fillText(line,x,lineY);
}

function captureStyledFallback(el,leafKind){
  if(typeof captureElementStyledPreview==="function"){
    var replica=captureElementStyledPreview(el,leafKind||null);
    if(replica)return replica;
  }
  var style=window.getComputedStyle(el);
  var rect=el.getBoundingClientRect();
  var w=Math.min(Math.max(Math.round(rect.width)||120,80),280);
  var h=Math.min(Math.max(Math.round(rect.height)||48,32),160);
  var canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  var ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.fillStyle=style.backgroundColor&&style.backgroundColor!=="rgba(0, 0, 0, 0)"?style.backgroundColor:"#ffffff";
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=style.borderColor||"#e4e4e7";
  ctx.lineWidth=1;
  ctx.strokeRect(0.5,0.5,w-1,h-1);
  ctx.fillStyle=style.color||"#18181b";
  ctx.font=(style.fontWeight||"400")+" "+(style.fontSize||"14px")+" "+(style.fontFamily||"sans-serif");
  wrapText(ctx,(el.textContent||"").trim().slice(0,160),w-16,8,Math.min(h/2,24));
  return {dataUrl:canvas.toDataURL("image/jpeg",0.75),captureKind:"styled_fallback",width:w,height:h};
}

function isSectionElement(el){
  return el&&(el.tagName==="SECTION"||el.getAttribute("data-site-section-id")||el.getAttribute("data-site-section-type"));
}

function isSectionOverviewField(fieldPath){
  return /sections\\[\\d+\\]\\.(title|body)$/.test(fieldPath||"");
}

function findInnerCardWrapper(sectionEl,clickTarget){
  if(!sectionEl||!clickTarget)return null;
  var node=clickTarget;
  while(node&&node!==sectionEl){
    if(node.getAttribute&&node.getAttribute("data-site-container-kind")==="inner_card")return node;
    if(hasCardClassHint(node))return node;
    node=node.parentElement;
  }
  return null;
}

function shouldUseInnerCardPreviewCapture(payload,sectionEl,clickTarget){
  if(!findInnerCardWrapper(sectionEl,clickTarget))return false;
  if(!payload||payload.pinScope!=="element")return true;
  var leaf=payload.targetChain&&payload.targetChain.length?payload.targetChain[payload.targetChain.length-1]:null;
  if(!leaf||leaf.role!=="element")return true;
  if(isSectionOverviewField(leaf.fieldPath))return false;
  if(leaf.fieldPath)return false;
  return true;
}

function resolveDragCaptureElement(sectionEl,clickTarget,root,innerCard,fullSection,leafKind,pinScope){
  if(innerCard)return innerCard;
  if(fullSection)return root;
  if(pinScope==="element"){
    if(leafKind==="item_card"||leafKind==="item_title"||leafKind==="item_body"||leafKind==="image_caption"){
      var card=findItemCardWrapper(clickTarget,sectionEl);
      if(card)return card;
    }
    if(leafKind==="panel"&&root!==sectionEl)return root;
    return clickTarget;
  }
  return root;
}

function shouldCaptureFullSectionPreview(payload,sectionEl,clickTarget){
  if(sectionEl&&clickTarget&&findInnerCardWrapper(sectionEl,clickTarget))return false;
  if(!payload||payload.pinScope!=="element")return true;
  var leaf=payload.targetChain&&payload.targetChain.length?payload.targetChain[payload.targetChain.length-1]:null;
  if(!leaf||leaf.role==="section")return true;
  return false;
}

function resolvePreviewCaptureRoot(sectionEl,clickTarget,payload){
  if(shouldUseInnerCardPreviewCapture(payload,sectionEl,clickTarget)){
    var innerCard=findInnerCardWrapper(sectionEl,clickTarget);
    if(innerCard)return innerCard;
  }
  if(shouldCaptureFullSectionPreview(payload,sectionEl,clickTarget))return sectionEl;
  return resolveCaptureRoot(sectionEl,clickTarget,payload);
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

${buildElementCaptureBridgeScript()}

${buildDomBitmapCaptureBridgeScript()}

function sectionHostBackground(el){
  if(!el)return "#ffffff";
  var style=window.getComputedStyle(el);
  if(typeof paintCanvasBackground==="function"){
    var probe=document.createElement("canvas");
    probe.width=1;probe.height=1;
    var pctx=probe.getContext("2d");
    if(pctx){
      paintCanvasBackground(pctx,1,1,style);
      return pctx.fillStyle||"#ffffff";
    }
  }
  var solid=pickElementFillColor(style);
  return solid||"#ffffff";
}

function inlineComputedStyles(source,target){
  if(!source||!target||source.nodeType!==1||target.nodeType!==1)return;
  var computed=window.getComputedStyle(source);
  var css="";
  for(var i=0;i<computed.length;i++){
    var prop=computed[i];
    css+=prop+":"+computed.getPropertyValue(prop)+";";
  }
  target.setAttribute("style",css);
  var srcChildren=source.children;
  var tgtChildren=target.children;
  for(var c=0;c<srcChildren.length;c++){
    if(tgtChildren[c])inlineComputedStyles(srcChildren[c],tgtChildren[c]);
  }
}

function captureRaster(el,clickTarget){
  var rect=el.getBoundingClientRect();
  var isSection=isSectionElement(el);
  var clipH=isSection?Math.min(220,Math.max(Math.round(rect.height),1)):Math.min(Math.max(Math.round(rect.height),1),400);
  var width=Math.min(Math.max(Math.round(rect.width),1),560);
  var height=clipH;
  var offsetY=0;
  if(isSection&&clickTarget){
    var clickRect=clickTarget.getBoundingClientRect();
    offsetY=Math.max(0,Math.min(clickRect.top-rect.top-clipH/2,Math.max(rect.height-clipH,0)));
    offsetY=Math.round(offsetY);
  }
  var clone=el.cloneNode(true);
  inlineComputedStyles(el,clone);
  if(isSection&&offsetY>0){
    clone.style.marginTop="-"+offsetY+"px";
    clone.style.height=Math.round(rect.height)+"px";
  }
  var host=document.createElement("div");
  host.style.cssText="position:fixed;left:-10000px;top:0;width:"+width+"px;height:"+height+"px;overflow:hidden;background:"+sectionHostBackground(el)+";";
  host.appendChild(clone);
  document.body.appendChild(host);
  try{
    var serialized=new XMLSerializer().serializeToString(clone);
    var svg='<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+width+'px;height:'+height+'px;overflow:hidden;">'+serialized+'</div></foreignObject></svg>';
    var url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    return new Promise(function(resolve){
      var img=new Image();
      img.onload=function(){
        try{
          var canvas=document.createElement("canvas");
          canvas.width=width*PREVIEW_THUMB_DPR;
          canvas.height=height*PREVIEW_THUMB_DPR;
          var ctx=canvas.getContext("2d");
          if(!ctx){resolve(null);return;}
          ctx.scale(PREVIEW_THUMB_DPR,PREVIEW_THUMB_DPR);
          paintCanvasBackground(ctx,width,height,window.getComputedStyle(el));
          ctx.drawImage(img,0,0,width,height);
          resolve({dataUrl:canvas.toDataURL("image/jpeg",0.82),captureKind:"raster",width:width,height:height});
        }catch(e){resolve(null);}
        finally{document.body.removeChild(host);}
      };
      img.onerror=function(){document.body.removeChild(host);resolve(null);};
      img.src=url;
    });
  }catch(e2){
    document.body.removeChild(host);
    return Promise.resolve(null);
  }
}

function captureCacheKey(payload){
  if(!payload)return "";
  return (payload.fieldPath||payload.surfaceId||payload.sectionId||"")+"::"+(payload.elementLabel||"");
}

function readCaptureCache(payload){
  var key=captureCacheKey(payload);
  if(!key)return null;
  var entry=captureCache[key];
  if(!entry)return null;
  if(Date.now()-entry.ts>CAPTURE_CACHE_TTL){delete captureCache[key];return null;}
  return entry.capture;
}

function writeCaptureCache(payload,capture){
  var key=captureCacheKey(payload);
  if(!key||!capture)return;
  captureCache[key]={capture:capture,ts:Date.now()};
}

function notifyPreviewThumb(payload,capture){
  if(!capture||!payload)return;
  notify(MSG.PREVIEW_THUMB,{
    sectionId:payload.sectionId,
    surfaceId:payload.surfaceId,
    fieldPath:payload.fieldPath,
    dataUrl:capture.dataUrl,
    captureKind:capture.captureKind,
    width:capture.width,
    height:capture.height
  });
}

function shouldUseElementCapture(payload){
  if(!payload||payload.pinScope!=="element")return false;
  var leafKind=captureLeafKind(payload);
  if(!leafKind)return false;
  return leafKind==="button"||leafKind==="contact_field"||leafKind==="heading"||leafKind==="body"||leafKind==="item_title"||leafKind==="item_body"||leafKind==="item_card"||leafKind==="image_caption"||leafKind==="panel";
}

function captureDragPreviewSync(){
  if(!dragState||!dragState.el||!dragState.target||!dragState.payload)return null;
  var payload=dragState.payload;
  var sectionEl=dragState.el;
  var clickTarget=dragState.target;
  var cached=readCaptureCache(payload);
  if(cached)return cached;
  var leafKind=captureLeafKind(payload);
  var useInnerCard=shouldUseInnerCardPreviewCapture(payload,sectionEl,clickTarget);
  var innerCard=useInnerCard?findInnerCardWrapper(sectionEl,clickTarget):null;
  var fullSection=shouldCaptureFullSectionPreview(payload,sectionEl,clickTarget);
  var root=resolvePreviewCaptureRoot(sectionEl,clickTarget,payload);
  var captureEl=resolveDragCaptureElement(sectionEl,clickTarget,root,innerCard,fullSection,leafKind,payload.pinScope);
  if(!fullSection&&shouldUseElementCapture(payload)&&typeof captureElementStyledPreview==="function"){
    var styled=captureElementStyledPreview(captureEl,leafKind);
    if(styled){
      writeCaptureCache(payload,styled);
      return styled;
    }
  }
  if(fullSection){
    var sectionPreview=typeof captureSectionStyledPreview==="function"?captureSectionStyledPreview(root):null;
    if(sectionPreview){
      writeCaptureCache(payload,sectionPreview);
      return sectionPreview;
    }
  }
  if(innerCard&&!shouldUseElementCapture(payload)&&typeof captureCardStyledFallback==="function"){
    var cardPreview=captureCardStyledFallback(innerCard);
    if(cardPreview){
      writeCaptureCache(payload,cardPreview);
      return cardPreview;
    }
  }
  return null;
}

function shouldSkipDomBitmapForElementCapture(payload,leafKind){
  if(payload&&dragState&&dragState.el&&dragState.target&&shouldUseInnerCardPreviewCapture(payload,dragState.el,dragState.target))return true;
  if(leafKind==="button"||leafKind==="contact_field")return true;
  if(leafKind==="heading"||leafKind==="body")return true;
  if(leafKind==="item_card"||leafKind==="item_title"||leafKind==="item_body"||leafKind==="image_caption")return false;
  if(payload&&payload.pinScope==="element"&&shouldUseElementCapture(payload))return true;
  return false;
}

function captureStyledElementPreview(payload,root,captureEl,leafKind,fullSection){
  if(fullSection||!shouldUseElementCapture(payload))return null;
  if(typeof captureElementStyledPreview==="function"){
    var styled=captureElementStyledPreview(captureEl,leafKind);
    if(styled)return styled;
  }
  return captureStyledPreviewFallback(payload,root,captureEl,leafKind,fullSection);
}

function captureAndNotifyDragPreview(){
  if(!dragState||!dragState.el||!dragState.target||!dragState.payload)return;
  var payload=dragState.payload;
  var sectionEl=dragState.el;
  var clickTarget=dragState.target;
  var useInnerCard=shouldUseInnerCardPreviewCapture(payload,sectionEl,clickTarget);
  var innerCard=useInnerCard?findInnerCardWrapper(sectionEl,clickTarget):null;
  var fullSection=shouldCaptureFullSectionPreview(payload,sectionEl,clickTarget);
  var root=resolvePreviewCaptureRoot(sectionEl,clickTarget,payload);
  var leafKind=captureLeafKind(payload);
  var captureEl=resolveDragCaptureElement(sectionEl,clickTarget,root,innerCard,fullSection,leafKind,payload.pinScope);
  function finish(capture){
    if(capture)writeCaptureCache(payload,capture);
    notifyPreviewThumb(payload,capture);
  }
  var styledElement=captureStyledElementPreview(payload,root,captureEl,leafKind,fullSection);
  if(styledElement){finish(styledElement);return;}
  if(innerCard&&shouldUseInnerCardPreviewCapture(payload,sectionEl,clickTarget)&&typeof captureCardStyledFallback==="function"){
    var cardStyled=captureCardStyledFallback(innerCard);
    if(cardStyled){finish(cardStyled);return;}
  }
  if(shouldSkipDomBitmapForElementCapture(payload,leafKind)){
    finish(null);
    return;
  }
  captureDomBitmap(captureEl,clickTarget).then(function(dom){
    if(dom){finish(dom);return;}
    var styled=captureStyledPreviewFallback(payload,root,captureEl,leafKind,fullSection);
    if(styled){finish(styled);return;}
    if(innerCard&&!shouldUseElementCapture(payload)&&typeof captureCardStyledFallback==="function"){
      var cardFallback=captureCardStyledFallback(innerCard);
      if(cardFallback){finish(cardFallback);return;}
    }
    if(!fullSection){finish(null);return;}
    captureRaster(root,clickTarget).then(function(raster){
      finish(raster||captureStyledFallback(root,leafKind));
    });
  });
}

function clearDraggableHover(){
  if(hoverOutlineEl){
    hoverOutlineEl.classList.remove(DRAGGABLE_HOVER);
    hoverOutlineEl=null;
  }
}

function applyDraggableHover(target){
  if(dragState)return;
  var root=findDraggableRoot(target);
  if(!root){clearDraggableHover();return;}
  var el=root.el;
  if(hoverOutlineEl===el)return;
  clearDraggableHover();
  el.classList.add(DRAGGABLE_HOVER);
  hoverOutlineEl=el;
}

function clearHighlight(){
  document.querySelectorAll("."+HIGHLIGHT+","+"."+HOVER).forEach(function(node){
    node.classList.remove(HIGHLIGHT);
    node.classList.remove(HOVER);
  });
}

function applyHighlight(sectionId,hover){
  clearHighlight();
  if(!sectionId){selectedId=null;selectedHover=false;return;}
  var el=findSectionNode(sectionId);
  if(el){
    el.classList.add(HIGHLIGHT);
    if(hover)el.classList.add(HOVER);
  }
  selectedId=sectionId;
  selectedHover=Boolean(hover);
}

function focusSection(sectionId){
  if(!sectionId)return;
  applyHighlight(sectionId,false);
  var el=findSectionNode(sectionId);
  if(!el)return;
  try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});}
  catch(e){try{el.scrollIntoView();}catch(e2){}}
}

function notify(type,payload){
  try{window.parent.postMessage({type:type,payload:payload},"*");}catch(e){}
}

function notifyPointerDown(payload,clientX,clientY,grabOffsetX,grabOffsetY){
  notify(MSG.POINTER_DOWN,Object.assign({},payload,{clientX:clientX,clientY:clientY,grabOffsetX:grabOffsetX,grabOffsetY:grabOffsetY}));
}

function markDragSource(el){
  document.querySelectorAll(".site-editor-drag-source").forEach(function(node){node.classList.remove("site-editor-drag-source");});
  if(el&&el.classList)el.classList.add("site-editor-drag-source");
}

function clearDragSource(){
  document.querySelectorAll(".site-editor-drag-source").forEach(function(node){node.classList.remove("site-editor-drag-source");});
}

document.addEventListener("mousedown",function(e){
  if(e.button!==0)return;
  var root=findDraggableRoot(e.target);
  if(!root)return;
  if(dragState){
    document.documentElement.classList.remove("site-editor-dragging");
    clearDragSource();
    dragState=null;
  }
  var el=root.el;
  var payload=readPayload(el,e.target,root.type);
  if(!payload.sectionId)return;
  e.preventDefault();
  e.stopPropagation();
  clearDraggableHover();
  var targetRect=e.target.getBoundingClientRect?e.target.getBoundingClientRect():{left:0,top:0};
  var grabOffsetX=e.clientX-targetRect.left;
  var grabOffsetY=e.clientY-targetRect.top;
  dragState={payload:payload,startX:e.clientX,startY:e.clientY,started:false,el:el,target:e.target,grabOffsetX:grabOffsetX,grabOffsetY:grabOffsetY};
  notifyPointerDown(payload,e.clientX,e.clientY,grabOffsetX,grabOffsetY);
  try{
    var early=captureDragPreviewSync();
    if(early)notifyPreviewThumb(dragState.payload,early);
  }catch(captureErr){}
},true);

document.addEventListener("mousemove",function(e){
  if(!dragState){
    applyDraggableHover(e.target);
    return;
  }
  if(dragState.started)return;
  var dx=e.clientX-dragState.startX;
  var dy=e.clientY-dragState.startY;
  if(dx*dx+dy*dy>=DRAG_THRESHOLD*DRAG_THRESHOLD){
    dragState.started=true;
    document.documentElement.classList.add("site-editor-dragging");
    markDragSource(dragState.target);
    notify(MSG.DRAG_START,Object.assign({},dragState.payload,{clientX:e.clientX,clientY:e.clientY,grabOffsetX:dragState.grabOffsetX,grabOffsetY:dragState.grabOffsetY,started:true}));
    captureAndNotifyDragPreview();
  }
},true);

document.addEventListener("mouseup",function(){
  if(dragState&&dragState.started){
    document.documentElement.classList.remove("site-editor-dragging");
    clearDragSource();
  }
  dragState=null;
},true);

document.addEventListener("mousedown",function(e){
  if(e.button!==0||dragState)return;
  if(findDraggableRoot(e.target))return;
  notify(MSG.DISMISS,{});
},true);

window.addEventListener("message",function(event){
  if(event.source!==window.parent)return;
  if(event.origin!==parentOrigin&&event.origin!==window.location.origin)return;
  var data=event.data;
  if(!data||typeof data.type!=="string")return;
  if(data.type===MSG.CLEAR){clearHighlight();selectedId=null;selectedHover=false;}
  else if(data.type===MSG.FOCUS&&data.payload&&data.payload.sectionId){focusSection(data.payload.sectionId);}
  else if(data.type===MSG.HIGHLIGHT&&data.payload&&data.payload.sectionId){
    var sid=data.payload.sectionId;
    var hover=Boolean(data.payload.hover);
    if(sid===selectedId&&hover===selectedHover)return;
    applyHighlight(sid,hover);
  }
  else if(data.type===MSG.PARENT_DRAG_START&&data.payload&&data.payload.started){
    document.documentElement.classList.add("site-editor-dragging");
    if(dragState)dragState.started=true;
    captureAndNotifyDragPreview();
  }
  else if(data.type===MSG.DRAG_START&&data.payload&&data.payload.started){
    document.documentElement.classList.add("site-editor-dragging");
    dragState=dragState||{started:true};
    if(dragState)dragState.started=true;
    captureAndNotifyDragPreview();
  }
  else if(data.type===MSG.DRAG_CANCEL){
    document.documentElement.classList.remove("site-editor-dragging");
    clearDragSource();
    dragState=null;
  }
});

bootstrapElementAttrsUniversal();
notify(MSG.READY,{version:${PREVIEW_SECTION_BRIDGE_VERSION},sections:allSections().length});
})();`;
}
