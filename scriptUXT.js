const API_URL = 'https://uxt-api-1.onrender.com/rutas/visitas'
//const API_URL = 'http://localhost:3000/rutas/visitas';
// ;
console.log ("algo")

function getUserID() {
  const STORAGE_KEY = "my_analytics_uid";

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  let uid = localStorage.getItem(STORAGE_KEY);
  const isReturning = !!uid;
  if (!uid) {
    uid = generateUUID();
    localStorage.setItem(STORAGE_KEY, uid);
  }
  return { uid, recurrente: isReturning };
}

function obtenerInfoPagina() {
  let infoUsuario = getUserID();
  return {
    uid: infoUsuario.uid,
    recurrente: infoUsuario.recurrente,
    title: document.title || 'Titulo por defecto',
    url: window.location.href || 'https://ejemplo.com',
    dominio: window.location.hostname || 'ejemplo.com',
    userAgent: navigator.userAgent || 'desconocido',
    referrer: document.referrer || 'Directo'
  };
}

async function enviarDatosAPI(datos) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(datos)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Respuesta de error de la API:', errBody);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const resultado = await response.json();
    console.log('Datos enviados exitosamente:', resultado);
    return resultado;

  } catch (error) {
    console.error('Error al enviar datos:', error);
    throw error;
  }
}

//RECOLECCIÓN DE CLICS

function obtenerSelectorElemento(el) {
  if (!el) return 'unknown';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const clases = el.classList.length ? '.' + [...el.classList].join('.') : '';
  const texto = el.innerText ? el.innerText.trim().slice(0, 30) : '';
  return `${tag}${id}${clases}${texto ? ` ("${texto}")` : ''}`;
}

document.addEventListener('click', function(e) {
  const infoPagina = obtenerInfoPagina();
  const datosClic = {
    ...infoPagina,
    tipo_evento: 'clic',
    elemento: obtenerSelectorElemento(e.target),
    posicion_x: e.clientX,
    posicion_y: e.clientY,
    timestamp: new Date().toISOString()
  };

  console.log('Clic registrado:', datosClic);
  enviarDatosAPI(datosClic);
});

//RECOLECCIÓN DE SCROLL 
let scrollTimeout = null;
let ultimoScroll = 0;

window.addEventListener('scroll', function() {

  const ahora = Date.now();
  if (ahora - ultimoScroll < 1000) return;
  ultimoScroll = ahora;

  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(function() {
    const infoPagina = obtenerInfoPagina();
    const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
    const porcentajeScroll = alturaTotal > 0
      ? Math.round((window.scrollY / alturaTotal) * 100)
      : 0;

    const datosScroll = {
      ...infoPagina,
      tipo_evento: 'scroll',
      scroll_y: window.scrollY,
      scroll_x: window.scrollX,
      porcentaje_scroll: porcentajeScroll,
      timestamp: new Date().toISOString()
    };

    console.log('Scroll registrado:', datosScroll);
    enviarDatosAPI(datosScroll);
  }, 300);
});

const datos = obtenerInfoPagina();
datos.tipo_evento = 'visita';
datos.timestamp = new Date().toISOString();
console.log(datos);
enviarDatosAPI(datos);