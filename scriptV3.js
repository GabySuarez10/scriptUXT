const API_URL = 'https://uxt-api-1.onrender.com/rutas/visitas'

// ;const API_URL = 'http://localhost:3000/rutas/visitas';
console.log("algo")

function getUserID() {
  const STORAGE_KEY = "my_analytics_uid";

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

document.addEventListener('click', function (e) {
  const infoPagina = obtenerInfoPagina();
  
  // Para mapas de calor, necesitamos calcular una coordenada X que funcione en cualquier resolución.
  // La estrategia más confiable es centrar los clics relativos al ancho de la pantalla,
  // y luego sumar la mitad del ancho de la captura esperada (1280px)
  const offset_x = e.pageX - (window.innerWidth / 2);
  const normalized_x = Math.round(1280 / 2 + offset_x);

  const datosClic = {
    ...infoPagina,
    tipo_evento: 'clic',
    elemento: obtenerSelectorElemento(e.target),
    posicion_x: normalized_x,
    posicion_y: Math.round(e.pageY),
    timestamp: new Date().toISOString()
  };

  console.log('Clic registrado:', datosClic);
  enviarDatosAPI(datosClic);
});

//RECOLECCIÓN DE SCROLL 
let scrollTimeout = null;
let ultimoScroll = 0;

window.addEventListener('scroll', function () {

  const ahora = Date.now();
  if (ahora - ultimoScroll < 1000) return;
  ultimoScroll = ahora;

  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(function () {
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

// ══════════════════════════════════════════════════════════════════════
// CAPTURA DE PANTALLA (SNAPSHOT)
// ══════════════════════════════════════════════════════════════════════
(function () {
  const html2canvasScript = document.createElement('script');
  html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  html2canvasScript.async = true;
  document.head.appendChild(html2canvasScript);

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (typeof html2canvas !== 'undefined') {
        captureAndSendSnapshot();
      } else {
        let retries = 0;
        const interval = setInterval(function () {
          retries++;
          if (typeof html2canvas !== 'undefined') {
            clearInterval(interval);
            captureAndSendSnapshot();
          } else if (retries >= 5) {
            clearInterval(interval);
            console.error('No se pudo cargar html2canvas desde el CDN.');
          }
        }, 300);
      }
    }, 1500);
  });

  function captureAndSendSnapshot() {
    html2canvas(document.body, {
      useCORS: true,
      scale: 0.5,
      logging: false
    }).then(function (canvas) {
      const base64Image = canvas.toDataURL('image/jpeg', 0.6);
      const snapshotApiUrl = API_URL.replace('/visitas', '/snapshot');

      fetch(snapshotApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: window.location.href,
          snapshot: base64Image
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          console.log('Captura de pantalla enviada exitosamente');
        })
        .catch(function (err) {
          console.error('Error al enviar captura de pantalla:', err);
        });
    }).catch(function (err) {
      console.error('Error al generar captura con html2canvas:', err);
    });
  }
})();

// ══════════════════════════════════════════════════════════════════════
// FEEDBACK POPUP SYSTEM
// ══════════════════════════════════════════════════════════════════════

(function () {
  const SERVER_URL = API_URL.replace('/rutas/visitas', '');
  const MAX_POPUPS_PER_SESSION = 2;
  const TRIGGER_CLICKS = 15;
  const TRIGGER_SCROLLS = 10;
  const TRIGGER_TIME_MS = 10 * 60 * 1000; // 10 minutos

  // ── Session state ──
  const sessionKey = 'uxt_fb_session';
  const countKey = 'uxt_fb_count';
  const questionsKey = 'uxt_fb_questions';
  const clicksKey = 'uxt_fb_clicks';
  const scrollsKey = 'uxt_fb_scrolls';
  const timeKey = 'uxt_fb_time_start';

  // Generate or retrieve session ID
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = 'ses_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    sessionStorage.setItem(sessionKey, sessionId);
  }

  let feedbackCount = parseInt(sessionStorage.getItem(countKey) || '0', 10);
  let shownQuestions = JSON.parse(sessionStorage.getItem(questionsKey) || '[]');
  
  let clicksSinceLast = parseInt(sessionStorage.getItem(clicksKey) || '0', 10);
  let scrollsSinceLast = parseInt(sessionStorage.getItem(scrollsKey) || '0', 10);
  
  let timeStart = parseInt(sessionStorage.getItem(timeKey) || '0', 10);
  if (!timeStart) {
    timeStart = Date.now();
    sessionStorage.setItem(timeKey, String(timeStart));
  }

  let popupActive = false;

  // ── Question Bank ──
  const questionBank = [
    '¿Qué tan satisfecho estás con tu visita?',
    '¿Qué tan fácil fue encontrar lo que buscabas?',
    '¿El contenido de la página cumplió tus expectativas?',
    '¿Pudiste completar lo que venías a hacer?',
    '¿Recomendarías esta página a otras personas?',
    '¿Qué tan claro fue el contenido que encontraste?',
    '¿Cómo calificarías tu experiencia general en esta página?',
    '¿La página respondió a lo que necesitabas?',
    '¿La experiencia de navegación fue agradable?',
    '¿Fue sencillo moverse entre las secciones de la página?'
  ];

  // ── Increment counters from existing event listeners ──
  document.addEventListener('click', function () {
    if (!popupActive) {
      clicksSinceLast++;
      sessionStorage.setItem(clicksKey, String(clicksSinceLast));
      checkFeedbackTrigger();
    }
  });

  window.addEventListener('scroll', function () {
    if (!popupActive) {
      scrollsSinceLast++;
      sessionStorage.setItem(scrollsKey, String(scrollsSinceLast));
      checkFeedbackTrigger();
    }
  });

  // Check time periodically even if there are no interactions
  setInterval(function() {
    if (!popupActive && feedbackCount < MAX_POPUPS_PER_SESSION) {
      checkFeedbackTrigger();
    }
  }, 5000);

  // ── Trigger logic ──
  function checkFeedbackTrigger() {
    if (feedbackCount >= MAX_POPUPS_PER_SESSION) {
      return;
    }
    if (popupActive) return;

    const elapsed = Date.now() - timeStart;
    
    const conditionClicks = clicksSinceLast >= TRIGGER_CLICKS;
    const conditionScrolls = scrollsSinceLast >= TRIGGER_SCROLLS;
    const conditionTime = elapsed >= TRIGGER_TIME_MS;

    if (conditionClicks || conditionScrolls || conditionTime) {
      console.log(`[UXT Feedback] ✅ Condición cumplida: Clics(${clicksSinceLast}/${TRIGGER_CLICKS}), Scrolls(${scrollsSinceLast}/${TRIGGER_SCROLLS}), Tiempo(${Math.round(elapsed/1000)}s/${TRIGGER_TIME_MS/1000}s)`);
      showFeedbackPopup();
    }
  }

  // ── Pick random question ──
  function pickQuestion() {
    const available = questionBank.filter(function (q) {
      return shownQuestions.indexOf(q) === -1;
    });
    if (available.length === 0) return questionBank[Math.floor(Math.random() * questionBank.length)];
    return available[Math.floor(Math.random() * available.length)];
  }

  // ── Show popup iframe ──
  function showFeedbackPopup() {
    if (popupActive) return;
    popupActive = true;

    var question = pickQuestion();
    shownQuestions.push(question);
    sessionStorage.setItem(questionsKey, JSON.stringify(shownQuestions));

    // Create iframe pointing to the hosted widget
    var iframe = document.createElement('iframe');
    iframe.id = 'uxt-feedback-iframe';
    iframe.src = SERVER_URL + '/feedback-widget.html' +
      '?question=' + encodeURIComponent(question) +
      '&session_id=' + encodeURIComponent(sessionId) +
      '&url=' + encodeURIComponent(window.location.href);

    // Style the iframe container positioning
    iframe.style.position = 'fixed';
    iframe.style.bottom = '12px';
    iframe.style.right = '12px';
    iframe.style.width = '360px';
    iframe.style.height = '440px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.background = 'transparent';
    iframe.style.pointerEvents = 'auto';

    document.body.appendChild(iframe);

    // Update counters for session
    feedbackCount++;
    sessionStorage.setItem(countKey, String(feedbackCount));
    
    // Reset individual counters for the next popup
    clicksSinceLast = 0;
    scrollsSinceLast = 0;
    timeStart = Date.now();
    
    sessionStorage.setItem(clicksKey, '0');
    sessionStorage.setItem(scrollsKey, '0');
    sessionStorage.setItem(timeKey, String(timeStart));
  }

  // ── Listen to iframe close message ──
  window.addEventListener('message', function (event) {
    if (event.data === 'close-uxt-feedback') {
      var iframe = document.getElementById('uxt-feedback-iframe');
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      popupActive = false;
    }
  });
})();
