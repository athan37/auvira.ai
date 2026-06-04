/**
 * Preview iframe bridge script (served externally to avoid inline-script CSP blocks).
 */

export const PREVIEW_SECTION_BRIDGE_VERSION = 17;

const HIGHLIGHT_CLASS = 'site-editor-section-highlight';
const HOVER_CLASS = 'site-editor-section-hover';

/** CSS injected into proxied preview HTML alongside the external bridge script. */
export const PREVIEW_SECTION_SELECTION_STYLES = `<style id="preview-section-selection-styles">
.${HIGHLIGHT_CLASS},.${HOVER_CLASS}{outline:3px solid #2563eb!important;outline-offset:3px!important;box-shadow:0 0 0 1px #2563eb,inset 0 0 0 9999px rgba(59,130,246,0.28)!important}
.site-editor-preview-bridge section,.site-editor-preview-bridge section[id],.site-editor-preview-bridge [data-site-section-id],.site-editor-preview-bridge [data-analytics-id],.site-editor-preview-bridge [data-site-config-field-path]{cursor:grab!important}
.site-editor-preview-bridge.site-editor-dragging section,.site-editor-preview-bridge.site-editor-dragging section[id],.site-editor-preview-bridge.site-editor-dragging [data-site-section-id],.site-editor-preview-bridge.site-editor-dragging [data-analytics-id],.site-editor-preview-bridge.site-editor-dragging [data-site-config-field-path]{cursor:grabbing!important}
.site-editor-preview-bridge [data-site-config-field-path]:active{cursor:grabbing!important}
</style>`;

/** JavaScript body for the preview section selection bridge (no script tags). */
export function buildSectionBridgeScriptBody(): string {
  return `(function(){
var MSG={DRAG_START:"SITE_SECTION_DRAG_START",POINTER_DOWN:"SITE_SECTION_POINTER_DOWN",READY:"SITE_SECTION_BRIDGE_READY",HIGHLIGHT:"SITE_SECTION_HIGHLIGHT",FOCUS:"SITE_SECTION_FOCUS",DISMISS:"SITE_SECTION_DISMISS",CLEAR:"SITE_SECTION_CLEAR_SELECTION"};
var HIGHLIGHT="${HIGHLIGHT_CLASS}";
var HOVER="${HOVER_CLASS}";
var DRAG_THRESHOLD=6;
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

function setElementAttr(el,kind,label,fieldPath,itemIndex){
  if(!el||el.getAttribute("data-site-element-kind"))return;
  el.setAttribute("data-site-element-kind",kind);
  el.setAttribute("data-site-element-label",label);
  el.setAttribute("data-site-config-field-path",fieldPath);
  if(itemIndex!=null)el.setAttribute("data-site-item-index",String(itemIndex));
}

function bootstrapItemCards(sectionEl,sectionIndex){
  var cards=sectionEl.querySelectorAll("h3");
  for(var i=0;i<cards.length;i++){
    var titleEl=cards[i];
    if(titleEl.closest("h2"))continue;
    setElementAttr(titleEl,"item_title","Item title","sections["+sectionIndex+"].items["+i+"].title",i);
    var bodyEl=titleEl.parentElement&&titleEl.parentElement.querySelector("p");
    if(bodyEl)setElementAttr(bodyEl,"item_body","Item description","sections["+sectionIndex+"].items["+i+"].description",i);
  }
}

function bootstrapContactSection(sectionEl,sectionIndex){
  var h2=sectionEl.querySelector("h2");
  if(h2)setElementAttr(h2,"heading","Section title","sections["+sectionIndex+"].title");
  var intro=sectionEl.querySelector("h2 + p, p.mt-6");
  if(intro)setElementAttr(intro,"body","Section intro","sections["+sectionIndex+"].body");
  var h3=sectionEl.querySelector("h3");
  if(h3)setElementAttr(h3,"heading","Contact Information","sections["+sectionIndex+"].subtitle");
  var ctas=sectionEl.querySelectorAll('a[href="#contact"]');
  for(var i=0;i<ctas.length;i++){
    var cta=ctas[i];
    var cls=cta.className||"";
    if(/primaryButton/.test(cls))setElementAttr(cta,"button","Primary button","hero.primaryCta");
  }
  var phoneLink=sectionEl.querySelector('a[href^="tel:"]');
  if(phoneLink)setElementAttr(phoneLink,"button","Phone button","contact.phone");
  var cardRows=sectionEl.querySelectorAll(".rounded-2xl.border, .space-y-4 > div");
  for(var j=0;j<cardRows.length;j++){
    var row=cardRows[j];
    var text=(row.textContent||"").trim();
    if(!text)continue;
    if(/\\+?\\d[\\d\\s().-]{6,}/.test(text)&&!row.getAttribute("data-site-element-kind")){
      setElementAttr(row,"contact_field","Phone in card","contact.phone");
    }else if(/@/.test(text)&&!row.getAttribute("data-site-element-kind")){
      setElementAttr(row,"contact_field","Email in card","contact.email");
    }
  }
}

function bootstrapElementAttrs(){
  var sections=allSections();
  for(var s=0;s<sections.length;s++){
    var sectionEl=sections[s];
    var idx=sectionIndexFromEl(sectionEl);
    if(!Number.isFinite(idx)||idx<0)continue;
    var type=(sectionEl.getAttribute("data-site-section-type")||sectionEl.id||"").toLowerCase();
    if(type==="contact"||sectionEl.id==="contact")bootstrapContactSection(sectionEl,idx);
    else if(/services|about|features|faq|testimonials|generic|gallery/.test(type))bootstrapItemCards(sectionEl,idx);
  }
}

function readElementPayload(sectionEl,target){
  var node=target;
  while(node&&node!==sectionEl){
    if(!node.getAttribute)break;
    var kind=node.getAttribute("data-site-element-kind");
    if(kind){
      var itemIdx=node.getAttribute("data-site-item-index");
      var parsedIdx=itemIdx!=null?parseInt(itemIdx,10):undefined;
      return{
        elementKind:kind,
        elementLabel:node.getAttribute("data-site-element-label")||"",
        fieldPath:node.getAttribute("data-site-config-field-path")||"",
        itemIndex:Number.isFinite(parsedIdx)?parsedIdx:undefined
      };
    }
    node=node.parentElement;
  }
  return null;
}

function readPayload(el,target){
  var id=el.getAttribute("data-site-section-id")||el.getAttribute("data-analytics-id")||el.id||"";
  var idx=sectionIndexFromEl(el);
  if(!Number.isFinite(idx))idx=-1;
  var type=el.getAttribute("data-site-section-type")||el.getAttribute("data-analytics-type")||el.id||"section";
  var title=el.getAttribute("data-site-section-title")||el.getAttribute("data-analytics-label")||el.id||type;
  if(id==="hero"||type==="hero"){idx=-1;type="hero";title=title||"Hero";}
  if(!id){id="section_"+idx+"_"+type;}
  var base={sectionId:id,analyticsId:id,sectionIndex:idx,sectionType:type,sectionTitle:title,kind:type==="hero"?"hero":"section"};
  var element=target?readElementPayload(el,target):null;
  if(!element)return base;
  return Object.assign({},base,element);
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

function notifyPointerDown(payload,clientX,clientY){
  notify(MSG.POINTER_DOWN,Object.assign({},payload,{clientX:clientX,clientY:clientY}));
}

document.addEventListener("mousedown",function(e){
  if(e.button!==0||dragState)return;
  var el=findSectionEl(e.target);
  if(!el)return;
  var payload=readPayload(el,e.target);
  if(!payload.sectionId)return;
  e.preventDefault();
  e.stopPropagation();
  dragState={payload:payload,startX:e.clientX,startY:e.clientY,started:false,el:el};
  notifyPointerDown(payload,e.clientX,e.clientY);
},true);

document.addEventListener("mouseup",function(){
  if(dragState&&dragState.started){
    document.documentElement.classList.remove("site-editor-dragging");
  }
  dragState=null;
},true);

document.addEventListener("mousedown",function(e){
  if(e.button!==0||dragState)return;
  if(findSectionEl(e.target))return;
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
  else if(data.type===MSG.DRAG_START&&data.payload&&data.payload.started){
    document.documentElement.classList.add("site-editor-dragging");
    dragState=dragState||{started:true};
    if(dragState)dragState.started=true;
  }
  else if(data.type==="SITE_SECTION_DRAG_CANCEL"){
    document.documentElement.classList.remove("site-editor-dragging");
    dragState=null;
  }
});

bootstrapElementAttrs();
notify(MSG.READY,{version:${PREVIEW_SECTION_BRIDGE_VERSION},sections:allSections().length});
})();`;
}
