const API_URL = 'https://uxt-api-1.onrender.com/rutas/visitas'
console.log("✅ UXTracks Analytics Script Inicializado")

// ══════════════════════════════════════════════════════════════════════
// PREVENCIÓN DE EJECUCIÓN EN DASHBOARD (IFRAME)
// ══════════════════════════════════════════════════════════════════════
if (window.self !== window.top) {
  console.warn("🚫 UXTracks: Ejecución detenida (detectado dentro de un iframe/dashboard).");
  throw new Error("UXTracks script execution prevented inside iframe to avoid metric interference.");
}

// ══════════════════════════════════════════════════════════════════════
// UTILIDADES BÁSICAS
// ══════════════════════════════════════════════════════════════════════

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
      body: JSON.stringify(datos),
      keepalive: true
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('❌ Error en API:', errBody);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const resultado = await response.json();
    console.log('✅ Datos enviados:', resultado);
    return resultado;

  } catch (error) {
    console.error('❌ Error al enviar:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ⭐ RECOLECCIÓN DE CLICS - VERSIÓN MEJORADA
// ══════════════════════════════════════════════════════════════════════

const CLICKS_CONFIG = {
  BATCH_SIZE: 5,
  BATCH_TIMEOUT: 8000,
  MAX_RETRIES: 3
};

let clicsPendientes = [];
let clicksBatchTimeout = null;
let clicksRetryCount = 0;

function obtenerSelectorElemento(el) {
  if (!el) return 'unknown';

  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const clases = el.classList.length
    ? '.' + [...el.classList].join('.')
    : '';

  const texto = el.innerText
    ? el.innerText.trim().slice(0, 30)
    : '';

  return `${tag}${id}${clases}${texto ? ` ("${texto}")` : ''}`;
}

function enviarBatchClics() {
  if (clicsPendientes.length === 0) return;

  console.log(`📤 [Clics] Enviando batch de ${clicsPendientes.length} clics...`);

  clicsPendientes.forEach(function (datosClic) {
    enviarDatosAPI(datosClic)
      .catch(function (error) {
        console.error('[Clics] Error:', error);
        if (clicksRetryCount < CLICKS_CONFIG.MAX_RETRIES) {
          clicksRetryCount++;
          console.log(`🔄 [Clics] Reintentando (${clicksRetryCount}/${CLICKS_CONFIG.MAX_RETRIES})...`);
          setTimeout(enviarBatchClics, 2000 * clicksRetryCount);
        }
      });
  });

  clicsPendientes = [];
  clicksRetryCount = 0;
}

function programarEnvioBatchClics() {
  if (clicksBatchTimeout) {
    clearTimeout(clicksBatchTimeout);
  }

  clicksBatchTimeout = setTimeout(function () {
    if (clicsPendientes.length > 0) {
      enviarBatchClics();
    }
  }, CLICKS_CONFIG.BATCH_TIMEOUT);
}

// ⭐ RECOLECCIÓN DE CLICS — FIX DEFINITIVO

document.addEventListener('click', function (e) {

  try {

    // ════════════════════════════════
    // SCROLL ACUMULADO DE CONTENEDORES
    // ════════════════════════════════

    let accumulatedScrollTop = 0;

    let parent = e.target;

    while (parent && parent !== document.body) {

      if (
        parent.scrollTop &&
        parent.scrollHeight > parent.clientHeight
      ) {

        accumulatedScrollTop += parent.scrollTop;

      }

      parent = parent.parentElement;

    }

    // ════════════════════════════════
    // COORDENADAS ABSOLUTAS REALES
    // ════════════════════════════════

    const absoluteX =
      e.clientX + window.scrollX;

    const absoluteY =
      e.clientY +
      window.scrollY +
      accumulatedScrollTop;

    // Validación
    if (
      isNaN(absoluteX) ||
      isNaN(absoluteY)
    ) {

      console.warn(
        '⚠️ Coordenadas inválidas'
      );

      return;

    }

    // ════════════════════════════════
    // ALTURA REAL DEL DOCUMENTO
    // ════════════════════════════════

    const realPageHeight = Math.max(

      document.body.scrollHeight,
      document.body.offsetHeight,

      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,

      document.documentElement.clientHeight

    );

    const infoPagina =
      obtenerInfoPagina();

    const datosClic = {

      ...infoPagina,

      tipo_evento: 'clic',

      elemento:
        obtenerSelectorElemento(e.target),

      // ✅ coordenadas finales
      posicion_x:
        Math.round(absoluteX),

      posicion_y:
        Math.round(absoluteY),

      // viewport
      viewport_width:
        window.innerWidth,

      viewport_height:
        window.innerHeight,

      // página real
      page_width:
        document.documentElement.scrollWidth,

      page_height:
        realPageHeight,

      // scroll actual
      scroll_x:
        Math.round(window.scrollX),

      scroll_y:
        Math.round(window.scrollY),

      timestamp:
        new Date().toISOString()

    };

    console.log(
      '🖱️ Click REAL:',
      {
        y: datosClic.posicion_y,
        pageHeight: datosClic.page_height
      }
    );

    // ════════════════════════════════
    // ENCOLAR
    // ════════════════════════════════

    clicsPendientes.push(datosClic);

    if (
      clicsPendientes.length >=
      CLICKS_CONFIG.BATCH_SIZE
    ) {

      enviarBatchClics();

    } else {

      programarEnvioBatchClics();

    }

  } catch (err) {

    console.error(
      '❌ Error capturando clic:',
      err
    );

  }

}, true);

// ══════════════════════════════════════════════════════════════════════
// RECOLECCIÓN DE SCROLL
// ══════════════════════════════════════════════════════════════════════

let scrollTimeout = null;

window.addEventListener('scroll', function () {
  // Clear any existing timeout on every scroll event
  clearTimeout(scrollTimeout);
  
  // Set a new timeout to execute only after scrolling has stopped for 500ms
  scrollTimeout = setTimeout(function () {
    const infoPagina = obtenerInfoPagina();
    const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
    const porcentajeScroll = alturaTotal > 0
      ? Math.round((window.scrollY / alturaTotal) * 100)
      : 0;

    const datosScroll = {
      ...infoPagina,
      tipo_evento: 'scroll',
      scroll_y: Math.round(window.scrollY),
      scroll_x: Math.round(window.scrollX),
      porcentaje_scroll: porcentajeScroll,
      timestamp: new Date().toISOString()
    };

    console.log('📜 [Scrolls]:', datosScroll.scroll_y);
    enviarDatosAPI(datosScroll);
  }, 500); // 500ms de espera tras el último movimiento de scroll
}, { passive: true });

// ══════════════════════════════════════════════════════════════════════
// ENVÍO AL CERRAR LA PÁGINA
// ══════════════════════════════════════════════════════════════════════

window.addEventListener('beforeunload', function () {
  if (clicsPendientes.length > 0) {
    console.log('💾 [Page Unload] Enviando clics pendientes...');
    clicsPendientes.forEach(function (datosClic) {
      navigator.sendBeacon(API_URL, JSON.stringify(datosClic));
    });
  }
});

window.addEventListener('visibilitychange', function () {
  if (document.hidden && clicsPendientes.length > 0) {
    console.log('💾 [Visibility] Enviando clics pendientes...');
    enviarBatchClics();
  }
});

// ══════════════════════════════════════════════════════════════════════
// REPORTE INICIAL DE VISITA
// ══════════════════════════════════════════════════════════════════════

const datos = obtenerInfoPagina();
datos.tipo_evento = 'visita';
datos.timestamp = new Date().toISOString();
console.log('📊 [Visita] Reportada');
enviarDatosAPI(datos);

// ══════════════════════════════════════════════════════════════════════
// HERRAMIENTA DE DEBUGGING
// ══════════════════════════════════════════════════════════════════════

window.UXTracksDebug = {
  getStats: function () {
    return {
      pendingClicks: clicsPendientes.length,
      pageHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight
    };
  },
  forceSend: function () {
    enviarBatchClics();
    console.log('✅ Datos forzados a enviar');
  },
  testClick: function () {
    console.log('📍 Haz clic en cualquier lugar para ver las coordenadas');
  }
};

console.log('🛠️ Debug: UXTracksDebug.getStats()');

// ══════════════════════════════════════════════════════════════════════
// FEEDBACK POPUP SYSTEM
// ══════════════════════════════════════════════════════════════════════

(function () {
  const SERVER_URL = API_URL.replace('/rutas/visitas', '');
  const MAX_POPUPS_PER_SESSION = 2;
  const TRIGGER_CLICKS = 15;
  const TRIGGER_SCROLLS = 10;
  const TRIGGER_TIME_MS = 10 * 60 * 1000;

  const sessionKey = 'uxt_fb_session';
  const countKey = 'uxt_fb_count';
  const questionsKey = 'uxt_fb_questions';
  const clicksKey = 'uxt_fb_clicks';
  const scrollsKey = 'uxt_fb_scrolls';
  const timeKey = 'uxt_fb_time_start';

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

  setInterval(function () {
    if (!popupActive && feedbackCount < MAX_POPUPS_PER_SESSION) {
      checkFeedbackTrigger();
    }
  }, 5000);

  function checkFeedbackTrigger() {
    if (feedbackCount >= MAX_POPUPS_PER_SESSION) return;
    if (popupActive) return;

    const elapsed = Date.now() - timeStart;
    const conditionClicks = clicksSinceLast >= TRIGGER_CLICKS;
    const conditionScrolls = scrollsSinceLast >= TRIGGER_SCROLLS;
    const conditionTime = elapsed >= TRIGGER_TIME_MS;

    if (conditionClicks || conditionScrolls || conditionTime) {
      showFeedbackPopup();
    }
  }

  function pickQuestion() {
    const available = questionBank.filter(function (q) {
      return shownQuestions.indexOf(q) === -1;
    });
    if (available.length === 0) return questionBank[Math.floor(Math.random() * questionBank.length)];
    return available[Math.floor(Math.random() * available.length)];
  }

  function showFeedbackPopup() {
    if (popupActive) return;
    popupActive = true;

    var question = pickQuestion();
    shownQuestions.push(question);
    sessionStorage.setItem(questionsKey, JSON.stringify(shownQuestions));

    var iframe = document.createElement('iframe');
    iframe.id = 'uxt-feedback-iframe';
    iframe.src = SERVER_URL + '/feedback-widget.html' +
      '?question=' + encodeURIComponent(question) +
      '&session_id=' + encodeURIComponent(sessionId) +
      '&url=' + encodeURIComponent(window.location.href);

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

    feedbackCount++;
    sessionStorage.setItem(countKey, String(feedbackCount));

    clicksSinceLast = 0;
    scrollsSinceLast = 0;
    timeStart = Date.now();

    sessionStorage.setItem(clicksKey, '0');
    sessionStorage.setItem(scrollsKey, '0');
    sessionStorage.setItem(timeKey, String(timeStart));
  }

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
