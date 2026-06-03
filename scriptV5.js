const API_URL = 'https://uxt-api-1.onrender.com/rutas/visitas'

console.log("✅ UXTracks Analytics Script Inicializado")

// ══════════════════════════════════════════════════════════════════════
// UTILIDADES BÁSICAS
// ══════════════════════════════════════════════════════════════════════

function getUserID() {

  const STORAGE_KEY = "my_analytics_uid";

  function generateUUID() {

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, function (c) {

        const r = Math.random() * 16 | 0;

        const v =
          c === 'x'
            ? r
            : (r & 0x3 | 0x8);

        return v.toString(16);

      });

  }

  let uid =
    localStorage.getItem(STORAGE_KEY);

  const isReturning = !!uid;

  if (!uid) {

    uid = generateUUID();

    localStorage.setItem(
      STORAGE_KEY,
      uid
    );

  }

  return {
    uid,
    recurrente: isReturning
  };

}

function obtenerInfoPagina() {

  let infoUsuario = getUserID();

  return {

    uid: infoUsuario.uid,

    recurrente:
      infoUsuario.recurrente,

    title:
      document.title ||
      'Titulo por defecto',

    url:
      window.location.href,

    dominio:
      window.location.hostname,

    userAgent:
      navigator.userAgent,

    referrer:
      document.referrer || 'Directo'

  };

}

async function enviarDatosAPI(datos) {

  try {

    const response = await fetch(API_URL, {

      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        'Accept':
          'application/json'

      },

      body:
        JSON.stringify(datos),

      keepalive: true

    });

    if (!response.ok) {

      const errBody =
        await response.json()
          .catch(() => ({}));

      console.error(
        '❌ Error API:',
        errBody
      );

      throw new Error(
        `HTTP ${response.status}`
      );

    }

    return await response.json();

  } catch (error) {

    console.error(
      '❌ Error al enviar:',
      error
    );

    throw error;

  }

}

// ══════════════════════════════════════════════════════════════════════
// CONFIG CLICKS
// ══════════════════════════════════════════════════════════════════════

const CLICKS_CONFIG = {

  BATCH_SIZE: 5,

  BATCH_TIMEOUT: 8000,

  MAX_RETRIES: 3

};

let clicsPendientes = [];

let clicksBatchTimeout = null;

let clicksRetryCount = 0;

// ══════════════════════════════════════════════════════════════════════
// SELECTOR ELEMENTO
// ══════════════════════════════════════════════════════════════════════

function obtenerSelectorElemento(el) {

  if (!el) return 'unknown';

  const tag =
    el.tagName.toLowerCase();

  const id =
    el.id ? `#${el.id}` : '';

  const clases =
    el.classList.length
      ? '.' + [...el.classList].join('.')
      : '';

  const texto =
    el.innerText
      ? el.innerText.trim().slice(0, 30)
      : '';

  return `${tag}${id}${clases}${texto ? ` ("${texto}")` : ''}`;

}

// ══════════════════════════════════════════════════════════════════════
// ENVÍO BATCH
// ══════════════════════════════════════════════════════════════════════

function enviarBatchClics() {

  if (
    clicsPendientes.length === 0
  ) return;

  console.log(
    `📤 Enviando ${clicsPendientes.length} clics`
  );

  clicsPendientes.forEach(function (datosClic) {

    enviarDatosAPI(datosClic)

      .catch(function (error) {

        console.error(
          '[Clics] Error:',
          error
        );

        if (
          clicksRetryCount <
          CLICKS_CONFIG.MAX_RETRIES
        ) {

          clicksRetryCount++;

          setTimeout(
            enviarBatchClics,
            2000 * clicksRetryCount
          );

        }

      });

  });

  clicsPendientes = [];

  clicksRetryCount = 0;

}

function programarEnvioBatchClics() {

  if (clicksBatchTimeout) {

    clearTimeout(
      clicksBatchTimeout
    );

  }

  clicksBatchTimeout =
    setTimeout(function () {

      if (
        clicsPendientes.length > 0
      ) {

        enviarBatchClics();

      }

    }, CLICKS_CONFIG.BATCH_TIMEOUT);

}

// ══════════════════════════════════════════════════════════════════════
// ⭐ CAPTURA DE CLICS FIX DEFINITIVO
// ══════════════════════════════════════════════════════════════════════

document.addEventListener('click', function (e) {

  try {

    // ✅ PAGE COORDS REALES
    const absoluteX = e.pageX;

    const absoluteY = e.pageY;

    if (
      isNaN(absoluteX) ||
      isNaN(absoluteY)
    ) return;

    // ALTURA REAL
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

      // ✅ COORDENADAS EXACTAS
      posicion_x:
        Math.round(absoluteX),

      posicion_y:
        Math.round(absoluteY),

      viewport_width:
        window.innerWidth,

      viewport_height:
        window.innerHeight,

      page_width:
        document.documentElement.scrollWidth,

      page_height:
        realPageHeight,

      scroll_x:
        Math.round(window.scrollX),

      scroll_y:
        Math.round(window.scrollY),

      timestamp:
        new Date().toISOString()

    };

    console.log(
      '🖱️ CLICK:',
      datosClic.posicion_x,
      datosClic.posicion_y
    );

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
      '❌ Error click:',
      err
    );

  }

}, true);

// ══════════════════════════════════════════════════════════════════════
// SCROLLS
// ══════════════════════════════════════════════════════════════════════

let scrollTimeout = null;

let ultimoScroll = 0;

window.addEventListener(
  'scroll',
  function () {

    const ahora = Date.now();

    if (
      ahora - ultimoScroll < 1000
    ) return;

    ultimoScroll = ahora;

    clearTimeout(scrollTimeout);

    scrollTimeout = setTimeout(
      function () {

        const infoPagina =
          obtenerInfoPagina();

        const alturaTotal =
          document.documentElement.scrollHeight -
          window.innerHeight;

        const porcentajeScroll =
          alturaTotal > 0
            ? Math.round(
              (window.scrollY / alturaTotal) * 100
            )
            : 0;

        const datosScroll = {

          ...infoPagina,

          tipo_evento: 'scroll',

          scroll_y:
            window.scrollY,

          scroll_x:
            window.scrollX,

          porcentaje_scroll:
            porcentajeScroll,

          timestamp:
            new Date().toISOString()

        };

        console.log(
          '📜 Scroll:',
          datosScroll.scroll_y
        );

        enviarDatosAPI(datosScroll);

      },

      300

    );

  },

  { passive: true }

);

// ══════════════════════════════════════════════════════════════════════
// ENVÍO AL CERRAR
// ══════════════════════════════════════════════════════════════════════

window.addEventListener(
  'beforeunload',
  function () {

    if (
      clicsPendientes.length > 0
    ) {

      clicsPendientes.forEach(
        function (datosClic) {

          navigator.sendBeacon(
            API_URL,
            JSON.stringify(datosClic)
          );

        }
      );

    }

  }
);

window.addEventListener(
  'visibilitychange',
  function () {

    if (
      document.hidden &&
      clicsPendientes.length > 0
    ) {

      enviarBatchClics();

    }

  }
);

// ══════════════════════════════════════════════════════════════════════
// VISITA
// ══════════════════════════════════════════════════════════════════════

const datos = obtenerInfoPagina();

datos.tipo_evento = 'visita';

datos.timestamp =
  new Date().toISOString();

console.log('📊 Visita reportada');

enviarDatosAPI(datos);

// ══════════════════════════════════════════════════════════════════════
// DEBUG
// ══════════════════════════════════════════════════════════════════════

window.UXTracksDebug = {

  getStats: function () {

    return {

      pendingClicks:
        clicsPendientes.length,

      pageHeight:
        document.documentElement.scrollHeight,

      scrollY:
        window.scrollY,

      viewportHeight:
        window.innerHeight

    };

  },

  forceSend: function () {

    enviarBatchClics();

    console.log(
      '✅ Datos enviados'
    );

  }

};

// ══════════════════════════════════════════════════════════════════════
// FEEDBACK SYSTEM
// ══════════════════════════════════════════════════════════════════════

(function () {

  const SERVER_URL =
    API_URL.replace(
      '/rutas/visitas',
      ''
    );

  const MAX_POPUPS_PER_SESSION = 2;

  const TRIGGER_CLICKS = 15;

  const TRIGGER_SCROLLS = 20;

  const TRIGGER_TIME_MS =
    10 * 60 * 1000;

  const sessionKey =
    'uxt_fb_session';

  const countKey =
    'uxt_fb_count';

  const questionsKey =
    'uxt_fb_questions';

  const clicksKey =
    'uxt_fb_clicks';

  const scrollsKey =
    'uxt_fb_scrolls';

  const timeKey =
    'uxt_fb_time_start';

  let sessionId =
    sessionStorage.getItem(sessionKey);

  if (!sessionId) {

    sessionId =
      'ses_' +
      Math.random()
        .toString(36)
        .substr(2, 12) +
      '_' +
      Date.now();

    sessionStorage.setItem(
      sessionKey,
      sessionId
    );

  }

  let feedbackCount =
    parseInt(
      sessionStorage.getItem(countKey) || '0',
      10
    );

  let shownQuestions =
    JSON.parse(
      sessionStorage.getItem(questionsKey) || '[]'
    );

  let clicksSinceLast =
    parseInt(
      sessionStorage.getItem(clicksKey) || '0',
      10
    );

  let scrollsSinceLast =
    parseInt(
      sessionStorage.getItem(scrollsKey) || '0',
      10
    );

  let timeStart =
    parseInt(
      sessionStorage.getItem(timeKey) || '0',
      10
    );

  if (!timeStart) {

    timeStart = Date.now();

    sessionStorage.setItem(
      timeKey,
      String(timeStart)
    );

  }

  let popupActive = false;

  const questionBank = [

    '¿Qué tan satisfecho estás con tu visita?',

    '¿Qué tan fácil fue encontrar lo que buscabas?',

    '¿El contenido cumplió tus expectativas?',

    '¿Pudiste completar lo que venías a hacer?',

    '¿Recomendarías esta página?',

    '¿Qué tan clara fue la información?',

    '¿Cómo calificarías tu experiencia?'

  ];

  // ════════════════════════════════════════
  // CLICK COUNTER
  // ════════════════════════════════════════

  document.addEventListener(
    'click',
    function () {

      if (!popupActive) {

        clicksSinceLast++;

        sessionStorage.setItem(
          clicksKey,
          String(clicksSinceLast)
        );

        checkFeedbackTrigger();

      }

    }
  );

  // ════════════════════════════════════════
  // SCROLL COUNTER FIX
  // ════════════════════════════════════════

  let lastFeedbackScroll = 0;

  window.addEventListener(
    'scroll',
    function () {

      const currentScroll =
        window.scrollY;

      // ✅ SOLO CONTAR SCROLLS GRANDES
      if (
        Math.abs(
          currentScroll -
          lastFeedbackScroll
        ) > 400
      ) {

        lastFeedbackScroll =
          currentScroll;

        if (!popupActive) {

          scrollsSinceLast++;

          sessionStorage.setItem(
            scrollsKey,
            String(scrollsSinceLast)
          );

          console.log(
            '📜 Scroll count:',
            scrollsSinceLast
          );

          checkFeedbackTrigger();

        }

      }

    },

    { passive: true }

  );

  // ════════════════════════════════════════
  // TIMER
  // ════════════════════════════════════════

  setInterval(function () {

    if (
      !popupActive &&
      feedbackCount <
      MAX_POPUPS_PER_SESSION
    ) {

      checkFeedbackTrigger();

    }

  }, 5000);

  // ════════════════════════════════════════
  // VALIDAR TRIGGER
  // ════════════════════════════════════════

  function checkFeedbackTrigger() {

    if (
      feedbackCount >=
      MAX_POPUPS_PER_SESSION
    ) return;

    if (popupActive) return;

    const elapsed =
      Date.now() - timeStart;

    const conditionClicks =
      clicksSinceLast >=
      TRIGGER_CLICKS;

    const conditionScrolls =
      scrollsSinceLast >=
      TRIGGER_SCROLLS;

    const conditionTime =
      elapsed >=
      TRIGGER_TIME_MS;

    if (

      conditionClicks ||

      conditionScrolls ||

      conditionTime

    ) {

      showFeedbackPopup();

    }

  }

  // ════════════════════════════════════════
  // PREGUNTA RANDOM
  // ════════════════════════════════════════

  function pickQuestion() {

    const available =
      questionBank.filter(function (q) {

        return (
          shownQuestions.indexOf(q) === -1
        );

      });

    if (available.length === 0) {

      return questionBank[
        Math.floor(
          Math.random() *
          questionBank.length
        )
      ];

    }

    return available[
      Math.floor(
        Math.random() *
        available.length
      )
    ];

  }

  // ════════════════════════════════════════
  // MOSTRAR POPUP
  // ════════════════════════════════════════

  function showFeedbackPopup() {

    if (popupActive) return;

    popupActive = true;

    const question =
      pickQuestion();

    shownQuestions.push(question);

    sessionStorage.setItem(
      questionsKey,
      JSON.stringify(shownQuestions)
    );

    const iframe =
      document.createElement('iframe');

    iframe.id =
      'uxt-feedback-iframe';

    iframe.src =
      SERVER_URL +
      '/feedback-widget.html' +

      '?question=' +
      encodeURIComponent(question) +

      '&session_id=' +
      encodeURIComponent(sessionId) +

      '&url=' +
      encodeURIComponent(
        window.location.href
      );

    iframe.style.position = 'fixed';

    iframe.style.bottom = '12px';

    iframe.style.right = '12px';

    iframe.style.width = '360px';

    iframe.style.height = '440px';

    iframe.style.border = 'none';

    iframe.style.zIndex = '999999';

    iframe.style.background =
      'transparent';

    iframe.style.pointerEvents =
      'auto';

    document.body.appendChild(
      iframe
    );

    feedbackCount++;

    sessionStorage.setItem(
      countKey,
      String(feedbackCount)
    );

    clicksSinceLast = 0;

    scrollsSinceLast = 0;

    timeStart = Date.now();

    sessionStorage.setItem(
      clicksKey,
      '0'
    );

    sessionStorage.setItem(
      scrollsKey,
      '0'
    );

    sessionStorage.setItem(
      timeKey,
      String(timeStart)
    );

  }

  // ════════════════════════════════════════
  // CERRAR POPUP
  // ════════════════════════════════════════

  window.addEventListener(
    'message',
    function (event) {

      if (
        event.data ===
        'close-uxt-feedback'
      ) {

        const iframe =
          document.getElementById(
            'uxt-feedback-iframe'
          );

        if (
          iframe &&
          iframe.parentNode
        ) {

          iframe.parentNode.removeChild(
            iframe
          );

        }

        popupActive = false;

      }

    }
  );

})();
