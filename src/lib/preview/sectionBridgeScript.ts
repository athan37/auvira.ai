/**
 * Preview iframe bridge script (served externally to avoid inline-script CSP blocks).
 */

export const PREVIEW_SECTION_BRIDGE_VERSION = 8;

const HIGHLIGHT_CLASS = 'site-editor-section-highlight';

/** CSS injected into proxied preview HTML alongside the external bridge script. */
export const PREVIEW_SECTION_SELECTION_STYLES = `<style id="preview-section-selection-styles">
.${HIGHLIGHT_CLASS}{outline:3px solid #2563eb!important;outline-offset:3px!important;box-shadow:0 0 0 6px rgba(37,99,235,0.35)!important}
.site-editor-preview-bridge section,.site-editor-preview-bridge section[id],.site-editor-preview-bridge [data-site-section-id],.site-editor-preview-bridge [data-analytics-id]{cursor:grab!important}
.site-editor-preview-bridge.site-editor-dragging section,.site-editor-preview-bridge.site-editor-dragging section[id],.site-editor-preview-bridge.site-editor-dragging [data-site-section-id],.site-editor-preview-bridge.site-editor-dragging [data-analytics-id]{cursor:grabbing!important}
</style>`;

/** JavaScript body for the preview section selection bridge (no script tags). */
export function buildSectionBridgeScriptBody(): string {
  return `(function(){
var MSG={DRAG_START:"SITE_SECTION_DRAG_START",READY:"SITE_SECTION_BRIDGE_READY",HIGHLIGHT:"SITE_SECTION_HIGHLIGHT",FOCUS:"SITE_SECTION_FOCUS",CLEAR:"SITE_SECTION_CLEAR_SELECTION"};
var HIGHLIGHT="${HIGHLIGHT_CLASS}";
var DRAG_THRESHOLD=6;
var selectedId=null;
var dragState=null;
var lastDragEndedAt=0;
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

function readPayload(el){
  var id=el.getAttribute("data-site-section-id")||el.getAttribute("data-analytics-id")||el.id||"";
  var idxAttr=el.getAttribute("data-site-section-index");
  var idx=idxAttr!=null?parseInt(idxAttr,10):allSections().indexOf(el);
  if(!Number.isFinite(idx))idx=-1;
  var type=el.getAttribute("data-site-section-type")||el.getAttribute("data-analytics-type")||el.id||"section";
  var title=el.getAttribute("data-site-section-title")||el.getAttribute("data-analytics-label")||el.id||type;
  if(id==="hero"||type==="hero"){idx=-1;type="hero";title=title||"Hero";}
  if(!id){id="section_"+idx+"_"+type;}
  return{sectionId:id,analyticsId:id,sectionIndex:idx,sectionType:type,sectionTitle:title};
}

function clearHighlight(){
  document.querySelectorAll("."+HIGHLIGHT).forEach(function(node){node.classList.remove(HIGHLIGHT);});
}

function applyHighlight(sectionId){
  clearHighlight();
  if(!sectionId){selectedId=null;return;}
  var el=findSectionNode(sectionId);
  if(el)el.classList.add(HIGHLIGHT);
  selectedId=sectionId;
}

function focusSection(sectionId){
  if(!sectionId)return;
  applyHighlight(sectionId);
  var el=findSectionNode(sectionId);
  if(!el)return;
  try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});}
  catch(e){try{el.scrollIntoView();}catch(e2){}}
}

function notify(type,payload){
  try{window.parent.postMessage({type:type,payload:payload},"*");}catch(e){}
}

function notifyDragStart(payload,clientX,clientY){notify(MSG.DRAG_START,Object.assign({},payload,{clientX:clientX,clientY:clientY}));}

document.addEventListener("mousemove",function(e){
  if(!dragState||dragState.started)return;
  var dx=e.clientX-dragState.startX;
  var dy=e.clientY-dragState.startY;
  if(dx*dx+dy*dy>=DRAG_THRESHOLD*DRAG_THRESHOLD){
    dragState.started=true;
    document.documentElement.classList.add("site-editor-dragging");
    notifyDragStart(dragState.payload,e.clientX,e.clientY);
  }
},true);

document.addEventListener("mousedown",function(e){
  if(e.button!==0||dragState)return;
  var el=findSectionEl(e.target);
  if(!el)return;
  var payload=readPayload(el);
  if(!payload.sectionId)return;
  e.preventDefault();
  dragState={payload:payload,startX:e.clientX,startY:e.clientY,started:false,el:el};
},true);

document.addEventListener("mouseup",function(){
  if(dragState&&dragState.started){
    document.documentElement.classList.remove("site-editor-dragging");
    lastDragEndedAt=Date.now();
  }
  dragState=null;
},true);

window.addEventListener("message",function(event){
  if(event.source!==window.parent)return;
  if(event.origin!==parentOrigin&&event.origin!==window.location.origin)return;
  var data=event.data;
  if(!data||typeof data.type!=="string")return;
  if(data.type===MSG.CLEAR){clearHighlight();selectedId=null;}
  else if(data.type===MSG.FOCUS&&data.payload&&data.payload.sectionId){focusSection(data.payload.sectionId);}
  else if(data.type===MSG.HIGHLIGHT&&data.payload&&data.payload.sectionId){
    if(data.payload.sectionId===selectedId)return;
    applyHighlight(data.payload.sectionId);
  }
});

notify(MSG.READY,{version:${PREVIEW_SECTION_BRIDGE_VERSION},sections:allSections().length});
})();`;
}
