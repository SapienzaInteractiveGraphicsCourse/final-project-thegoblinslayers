import * as THREE from 'three';

// Colore identico a HIGHLIGHT_COLOR in interactionSystem.js
const HIGHLIGHT_COLOR = new THREE.Color(0xf4c430);

// Intensità massima dell'emissive al t=1 (0.55 = visibile ma non accecante)
const MAX_HIGHLIGHT_INTENSITY = 0.25;

/**
 * Clona i materiali delle mesh fornite e li prepara per l'highlight emissivo.
 * Esclude le mesh con nome che contiene 'flame' o 'fire' per non
 * interferire con l'animazione delle fiamme delle torce.
 *
 * @param {THREE.Mesh[]} meshes  - array di mesh già raccolte con traverse
 * @returns {THREE.Material[]}   - array di materiali clonati pronti
 */
export function prepareHighlightMaterials(meshes) {
  const highlightMaterials = [];

  for (const mesh of meshes) {
    // Salta le mesh fiamma — hanno la propria logica emissive
    const name = (mesh.name || '').toLowerCase();
    if (name.includes('flame') || name.includes('fire')) continue;

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((mat) => {
        const cloned = mat.clone();
        _initEmissive(cloned);
        highlightMaterials.push(cloned);
        return cloned;
      });
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
      _initEmissive(mesh.material);
      highlightMaterials.push(mesh.material);
    }
  }

  return highlightMaterials;
}

/**
 * Applica il valore t [0..1] ai materiali highlight.
 * Chiamata ogni frame da setHighlightT nell'interactable.
 *
 * @param {THREE.Material[]} highlightMaterials
 * @param {number} t
 */
export function applyHighlight(highlightMaterials, t) {
  const intensity = t * MAX_HIGHLIGHT_INTENSITY;
  for (const mat of highlightMaterials) {
    if ('emissiveIntensity' in mat) {
      mat.emissiveIntensity = intensity;
    }
  }
}

// Imposta emissive color e parte da intensity 0
function _initEmissive(material) {
  if ('emissive' in material) {
    material.emissive = HIGHLIGHT_COLOR.clone();
    material.emissiveIntensity = 0;
  }
}