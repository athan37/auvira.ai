import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOM_BITMAP_CAPTURE_TIMEOUT_MS,
  DOM_BITMAP_ELEMENT_MAX_HEIGHT,
  DOM_BITMAP_MAX_WIDTH,
  DOM_BITMAP_SECTION_MAX_HEIGHT,
} from '@/lib/preview/domBitmapCapture';

/** Load the prebuilt modern-screenshot IIFE bundle for the preview bridge. */
export function loadDomBitmapCaptureBundle(): string {
  const bundlePath = join(process.cwd(), 'src/lib/preview/generated/domBitmapCapture.bundle.js');
  return readFileSync(bundlePath, 'utf8');
}

/** Bridge-side capture helpers (plain JS embedded in sectionBridgeScript). */
export function buildDomBitmapCaptureBridgeScript(): string {
  return `
function resolveDomBitmapDimensions(el,clickTarget){
  var rect=el.getBoundingClientRect();
  var isSection=isSectionElement(el);
  var maxW=${DOM_BITMAP_MAX_WIDTH};
  var maxH=isSection?${DOM_BITMAP_SECTION_MAX_HEIGHT}:${DOM_BITMAP_ELEMENT_MAX_HEIGHT};
  var srcW=Math.max(Math.round(rect.width),1);
  var srcH=Math.max(Math.round(rect.height),1);
  var clipH=isSection?Math.min(maxH,Math.max(srcH,80)):Math.min(Math.max(srcH,24),maxH);
  var width=Math.min(srcW,maxW);
  var height=clipH;
  var offsetY=0;
  if(isSection&&clickTarget&&clickTarget.getBoundingClientRect){
    var clickRect=clickTarget.getBoundingClientRect();
    offsetY=Math.max(0,Math.min(clickRect.top-rect.top-clipH/2,Math.max(srcH-clipH,0)));
    offsetY=Math.round(offsetY);
  }
  return {width:width,height:height,offsetY:offsetY,isSection:isSection};
}

function buildDomBitmapHost(el,dims){
  if(!dims.offsetY&&dims.width>=Math.round(el.getBoundingClientRect().width))return {host:null,target:el};
  var host=document.createElement("div");
  host.setAttribute("data-preview-dom-capture-host","1");
  host.style.cssText="position:fixed;left:-10000px;top:0;width:"+dims.width+"px;height:"+dims.height+"px;overflow:hidden;pointer-events:none;background:transparent;";
  var clone=el.cloneNode(true);
  if(typeof inlineComputedStyles==="function")inlineComputedStyles(el,clone);
  if(dims.offsetY>0)clone.style.marginTop="-"+dims.offsetY+"px";
  clone.style.width=dims.width+"px";
  host.appendChild(clone);
  document.body.appendChild(host);
  return {host:host,target:host};
}

function removeDomBitmapHost(host){
  if(host&&host.parentNode)host.parentNode.removeChild(host);
}

function captureDomBitmap(el,clickTarget){
  return new Promise(function(resolve){
    if(!el||!el.getBoundingClientRect||typeof PreviewDomCapture==="undefined"||typeof PreviewDomCapture.domToPngDataUrl!=="function"){
      resolve(null);
      return;
    }
    var dims=resolveDomBitmapDimensions(el,clickTarget);
    var mounted=buildDomBitmapHost(el,dims);
    var target=mounted.target;
    var sectionStyle=window.getComputedStyle(el);
    var bg=null;
    if(typeof pickElementFillColor==="function"){
      bg=pickElementFillColor(sectionStyle);
    }
    PreviewDomCapture.domToPngDataUrl(target,{
      width:dims.width,
      height:dims.height,
      scale:PREVIEW_THUMB_DPR,
      timeout:${DOM_BITMAP_CAPTURE_TIMEOUT_MS},
      backgroundColor:bg
    }).then(function(dataUrl){
      removeDomBitmapHost(mounted.host);
      if(!dataUrl){resolve(null);return;}
      resolve({dataUrl:dataUrl,captureKind:"raster",width:dims.width,height:dims.height});
    }).catch(function(){
      removeDomBitmapHost(mounted.host);
      resolve(null);
    });
  });
}

function captureStyledPreviewFallback(root,captureEl,leafKind,fullSection){
  if(!fullSection&&shouldUseElementCapture(dragState.payload)&&typeof captureElementStyledPreview==="function"){
    var styledEl=captureElementStyledPreview(captureEl,leafKind);
    if(styledEl)return styledEl;
  }
  if(fullSection&&typeof captureSectionStyledPreview==="function"){
    var sectionPreview=captureSectionStyledPreview(root);
    if(sectionPreview)return sectionPreview;
  }
  return captureStyledFallback(root,leafKind);
}
`;
}
