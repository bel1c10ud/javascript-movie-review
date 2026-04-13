(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function getURLSearchParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) ?? defaultValue;
}
function setURLSearchParams(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  history.replaceState({}, "", url);
}
function getQuery() {
  return getURLSearchParam("query", "");
}
function getPage() {
  const pageStr = getURLSearchParam("page", "1");
  const pageNum = Number(pageStr);
  const page = isNaN(pageNum) || pageNum % 1 || pageNum < 1 ? 1 : pageNum;
  return page;
}
const TOAST_DURATION_MS = 5e3;
function createToast({ title, message }) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = /*html*/
  `
    <div>
      <p class="toast-title">${title}</p>
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close" aria-label="닫기">✕</button>
  `;
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => removeToast(toast));
  return toast;
}
function removeToast(toast) {
  toast.classList.add("toast-hide");
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}
function getOrCreateContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}
function showErrorToast({ title, message }) {
  const container = getOrCreateContainer();
  const toast = createToast({ title, message });
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.isConnected) removeToast(toast);
  }, TOAST_DURATION_MS);
}
class AppError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = this.constructor.name;
  }
}
class APIError extends AppError {
  constructor(response) {
    super(`API 요청 실패: ${response.status} ${response.url}`);
    this.response = response;
  }
}
class TimeoutError extends AppError {
  constructor(endpoint, timeoutMs) {
    super(`요청 시간 초과 (${timeoutMs}ms): ${endpoint}`);
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}
class ParseError extends AppError {
  constructor(context, cause) {
    super(`${context.sourceName} 파싱 실패: ${context.raw}`, cause);
    this.cause = cause;
    this.type = context.type;
    this.sourceName = context.sourceName;
    this.raw = context.raw;
  }
  type;
  sourceName;
  raw;
}
class StorageError extends AppError {
  constructor(context, cause) {
    super(`LocalStorage ${context.action === "read" ? "읽기" : "쓰기"} 에러: ${context.key}`, cause);
    this.cause = cause;
    this.key = context.key;
    this.action = context.action;
  }
  key;
  action;
}
async function handleError(error) {
  console.error(error);
  if (error instanceof APIError) {
    const isJson = error.response.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await error.response.json() : await error.response.text();
    const bodyStr = String(body);
    const message2 = bodyStr.length ? bodyStr : "응답이 없습니다.";
    showErrorToast({ title: `API 에러 (${error.response.status})`, message: `${message2}` });
    return;
  }
  if (error instanceof TimeoutError) {
    showErrorToast({ title: "요청 시간 초과", message: error.message });
    return;
  }
  if (error instanceof AppError) {
    showErrorToast({ title: error.name, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : "알 수 없는 에러가 발생했습니다.";
  showErrorToast({ title: "에러", message });
}
const SHOW_MORE_THROTTLE_MS = 500;
const FETCH_OPTION = {
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyODEwZTc5YTJiZTY1MTBlYzg4MDVjM2QxYjU5MWFhOSIsIm5iZiI6MTc3NDg0NDAwOS4xMzkwMDAyLCJzdWIiOiI2OWM5Zjg2OWZmYTliZGM4ZWM0NGU2NjYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.qkDiOc1EJ1aP8EQ4z_1QW2WdEgA00xkmpFT47UOL-Oc"}`
  },
  timeoutMs: 1e4
};
const RATING_OPTIONS = [2, 4, 6, 8, 10];
const RATING_MESSAGES = {
  2: "최악이예요",
  4: "별로예요",
  6: "보통이에요",
  8: "재미있어요",
  10: "명작이에요"
};
function fetcher(url, { timeoutMs, ...options }) {
  const response = fetch(url, options).then(async (res) => {
    if (!res.ok) {
      throw new APIError(res);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new ParseError({ type: "json", sourceName: "API 응답", raw: text }, cause);
    }
  });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(url, timeoutMs));
    }, timeoutMs);
  });
  return timeoutMs ? Promise.race([response, timeoutPromise]) : response;
}
async function fetchMovieDetail(movieId) {
  const queryParams = new URLSearchParams({
    language: "ko-KR"
  });
  return fetcher(`${"https://api.themoviedb.org/3"}/movie/${movieId}?${queryParams}`, FETCH_OPTION);
}
async function fetchMovies(endpoint, params) {
  const queryParams = new URLSearchParams({
    language: "ko-KR",
    ...params
  });
  return fetcher(`${"https://api.themoviedb.org/3"}${endpoint}?${queryParams}`, FETCH_OPTION);
}
function fetchMyRating(movieId) {
  let raw;
  try {
    raw = localStorage.getItem("my-ratings");
  } catch (cause) {
    throw new StorageError({ key: "my-ratings", action: "read" }, cause);
  }
  try {
    const parsed = JSON.parse(raw ?? "{}");
    const myRating = Number(parsed[movieId]);
    return RATING_OPTIONS.includes(myRating) ? myRating : void 0;
  } catch (cause) {
    throw new ParseError({ type: "json", sourceName: "평점 데이터", raw }, cause);
  }
}
function updateMyRating(movieId, rating) {
  let raw;
  try {
    raw = localStorage.getItem("my-ratings");
  } catch (cause) {
    throw new StorageError({ key: "my-ratings", action: "read" }, cause);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw ?? "{}");
  } catch (cause) {
    throw new ParseError({ type: "json", sourceName: "평점 데이터", raw }, cause);
  }
  try {
    if (RATING_OPTIONS.includes(rating)) parsed[movieId] = rating;
    localStorage.setItem("my-ratings", JSON.stringify(parsed));
  } catch (cause) {
    throw new StorageError({ key: "my-ratings", action: "write" }, cause);
  }
}
function throttle$1(callback, ms) {
  let timer = null;
  return (...args) => {
    if (timer) return;
    callback(...args);
    timer = setTimeout(() => {
      timer = null;
    }, ms);
  };
}
function createScrollAreaElement() {
  const element = document.createElement("div");
  element.classList.add("scroll-area");
  element.style.height = "50px";
  return element;
}
let observer = null;
function bindBottomInfiniteScrollObserver(hasNextPage, callback) {
  const prevScrollAreaElement = document.querySelector(".scroll-area");
  if (prevScrollAreaElement) {
    observer?.unobserve(prevScrollAreaElement);
    prevScrollAreaElement.remove();
  }
  if (!hasNextPage) return;
  const scrollAreaElement = createScrollAreaElement();
  document.querySelector(".thumbnail-list")?.insertAdjacentElement("afterend", scrollAreaElement);
  if (observer) observer.disconnect();
  const throttledCallback = throttle$1(callback, SHOW_MORE_THROTTLE_MS);
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        throttledCallback();
      }
    });
  }, {
    rootMargin: "0px 0px 200px 0px"
  });
  observer.observe(scrollAreaElement);
}
function throttle(callback, ms) {
  let timer = null;
  return (...args) => {
    if (timer) return;
    callback(...args);
    timer = setTimeout(() => {
      timer = null;
    }, ms);
  };
}
function createTopScrollAreaElement() {
  const element = document.createElement("div");
  element.classList.add("scroll-area-top");
  element.style.height = "50px";
  return element;
}
let topObserver = null;
function bindTopInfiniteScrollObserver(hasPrevPage, callback) {
  const prevScrollAreaElement = document.querySelector(".scroll-area-top");
  if (prevScrollAreaElement) {
    topObserver?.unobserve(prevScrollAreaElement);
    prevScrollAreaElement.remove();
  }
  if (!hasPrevPage) return;
  const scrollAreaElement = createTopScrollAreaElement();
  const listElement = document.querySelector(".thumbnail-list");
  listElement?.insertAdjacentElement("beforebegin", scrollAreaElement);
  if (topObserver) topObserver.disconnect();
  const throttledCallback = throttle(callback, SHOW_MORE_THROTTLE_MS);
  topObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        throttledCallback();
      }
    });
  }, {
    rootMargin: "200px 0px 0px 0px"
  });
  topObserver.observe(scrollAreaElement);
}
function bindSelectRatingEvent(element) {
  element.addEventListener("click", async (event) => {
    try {
      if (!(event.target instanceof HTMLButtonElement)) return;
      const dialogElement = event.target.closest("dialog");
      const formElement = event.target.closest(".modal-movie-my-rating-selector");
      const movieIdStr = dialogElement.dataset.movieId;
      const ratingStr = event.target.dataset.rating;
      if (!movieIdStr) throw new AppError("영화 ID를 찾을 수 없습니다.");
      if (!ratingStr) throw new AppError("평점을 찾을 수 없습니다.");
      const movieId = Number(movieIdStr);
      const rating = Number(ratingStr);
      formElement.dataset.rating = ratingStr;
      await updateMyRating(movieId, rating);
    } catch (error) {
      await handleError(error);
    }
  });
}
function createMyRateSelectorElement(currentRating) {
  const formElement = document.createElement("div");
  formElement.classList.add("modal-movie-my-rating-selector");
  if (currentRating !== void 0) {
    formElement.dataset.rating = currentRating.toString();
  }
  const buttonElements = Array.from({ length: 5 }, (_, index) => {
    const buttonElement = document.createElement("button");
    buttonElement.type = "button";
    buttonElement.classList.add("star-button");
    buttonElement.dataset.rating = String((index + 1) * 2);
    return buttonElement;
  });
  formElement.append(...buttonElements);
  return formElement;
}
function createMyRatingMessagesElement() {
  const containerElement = document.createElement("div");
  containerElement.classList.add("modal-movie-my-rating-messages");
  containerElement.insertAdjacentHTML("beforeend", Object.entries(RATING_MESSAGES).map(([rating, message]) => (
    /*html*/
    `
    <p class="modal-movie-my-rating-message" data-rating="${rating}">
      <span>${message}</span>
      <span class="modal-movie-my-rating-message-score">(${rating}/10)</span>
    </p>
  `
  )).join(""));
  return containerElement;
}
async function renderMyRatingSelector(selector, movieId) {
  const myRating = await fetchMyRating(movieId);
  const myRateSelectorBody = document.querySelector(selector);
  const myRateSelectorElement = createMyRateSelectorElement(myRating);
  const myRatingMessagesElement = createMyRatingMessagesElement();
  myRateSelectorBody?.append(myRateSelectorElement, myRatingMessagesElement);
  bindSelectRatingEvent(myRateSelectorElement);
}
function createModalElement(movieDetail) {
  const dialogElement = document.createElement("dialog");
  dialogElement.classList.add("modal");
  dialogElement.dataset.movieId = movieDetail.id.toString();
  dialogElement.insertAdjacentHTML(
    "afterbegin",
    /* html */
    `
    <form method="dialog">
      <button class="modal-close-button">
        <img src="${"/javascript-movie-review/"}svg/x.svg" alt="close button" />
      </button>
    </form>
    <div class="modal-body">
      <div class="modal-movie-poster">
        <img 
          src="${"https://image.tmdb.org/t/p"}/w400${movieDetail.poster_path}"
          onerror="this.src='${"/javascript-movie-review/"}images/default_movie_image.png'"
          alt="${movieDetail.title}"
        />
      </div>
      <div class="modal-movie-content">
        <div class="modal-movie-header">
          <p class="modal-movie-title">${movieDetail.title}</p>
          <p class="modal-movie-info">${movieDetail.release_date.split("-")[0]} · ${movieDetail.genres.map((genre) => genre.name).join(", ")}</p>
          <p class="modal-movie-rate">
            <span>평균</span>
            <span>
              <img src="${"/javascript-movie-review/"}images/star_filled.png" alt="filled star" class="star" />
              <span class="modal-movie-rate-value">${movieDetail.vote_average.toFixed(1)}</span>
            </span>
          </p>
        </div>
        <div class="modal-movie-my-rating">
          <h3 class="modal-movie-content-title">내 평점</h3>
          <div class="modal-movie-my-rating-body">
          </div>
        </div>
        <div class="modal-movie-plot">
          <h3 class="modal-movie-content-title">줄거리</h3>
          <div class="modal-movie-plot-body">${movieDetail.overview}</div>
        </div>
      </div>
    </div>
  `
  );
  return dialogElement;
}
function createSpinnerElement() {
  const divElement = document.createElement("div");
  divElement.classList.add("spinner-overlay");
  divElement.id = "movie-loading-spinner";
  divElement.insertAdjacentHTML(
    "beforeend",
    /* html */
    `
    <div class="spinner"></div>
  `
  );
  return divElement;
}
function removeSpinnerElement() {
  document.getElementById("movie-loading-spinner")?.remove();
}
let isModalLoading = false;
async function renderModal(movieId) {
  if (isModalLoading) return;
  isModalLoading = true;
  try {
    document.querySelector(".modal")?.remove();
    document.body.insertAdjacentElement("beforeend", createSpinnerElement());
    const response = await fetchMovieDetail(movieId);
    const dialogElement = createModalElement(response);
    document.querySelector("#app")?.insertAdjacentElement("beforeend", dialogElement);
    await renderMyRatingSelector(".modal-movie-my-rating-body", movieId);
    dialogElement.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        dialogElement.close();
      }
    });
    dialogElement.showModal();
  } finally {
    removeSpinnerElement();
    isModalLoading = false;
  }
}
function bindClickMovieEvent(element) {
  element.addEventListener("click", async (event) => {
    try {
      const targetElement = event.target.closest("[data-movie-id]");
      if (targetElement) {
        const movieIdStr = targetElement.dataset.movieId;
        const movieId = Number(movieIdStr);
        if (!movieId) throw new Error("영화 ID를 찾을 수 없습니다.");
        await renderModal(movieId);
      }
    } catch (error) {
      await handleError(error);
    }
  });
}
const visibleItems = /* @__PURE__ */ new Set();
const visibleMovieObserver = new IntersectionObserver((entries) => {
  let isChanged = false;
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      if (!visibleItems.has(entry.target)) {
        visibleItems.add(entry.target);
        isChanged = true;
      }
    } else {
      if (visibleItems.has(entry.target)) {
        visibleItems.delete(entry.target);
        isChanged = true;
      }
    }
  });
  if (isChanged) {
    const allItems = Array.from(document.querySelectorAll(".thumbnail-list .item"));
    const firstVisibleItem = allItems.find((item) => visibleItems.has(item));
    if (firstVisibleItem && firstVisibleItem.dataset.movieId) {
      const movieId = firstVisibleItem.dataset.movieId;
      const page = firstVisibleItem.dataset.page;
      if (!page || !movieId) return;
      setURLSearchParams({
        page,
        "viewed-movie-id": movieId
      });
    }
  }
}, {
  threshold: 1
});
function observeVisibleMovieItem(movieElement) {
  visibleMovieObserver.observe(movieElement);
}
function createMovieItemElement(page, movie) {
  const liElement = document.createElement("li");
  liElement.classList.add("item");
  liElement.dataset.page = page.toString();
  liElement.dataset.movieId = movie.id.toString();
  liElement.insertAdjacentHTML(
    "beforeend",
    /*html*/
    `
    <img
      class="thumbnail"
      src="${"https://image.tmdb.org/t/p"}/w300${movie.poster_path}"
      onerror="this.src='${"/javascript-movie-review/"}images/default_movie_image.png'"
      alt="${movie.title}"
    />
    <div class="item-desc">
      <p class="rate">
        <img src="${"/javascript-movie-review/"}images/star_empty.png" alt="empty star" class="star" />
        <span>${movie.vote_average.toFixed(1)}</span>
      </p>
      <p class="movie-title">${movie.title}</p>
    </div>
  `
  );
  bindClickMovieEvent(liElement);
  observeVisibleMovieItem(liElement);
  return liElement;
}
function renderMovieItems(page, movieList, direction = "append") {
  const listElement = document.querySelector(".thumbnail-list");
  if (!listElement) return;
  const elements = movieList.map((movie) => createMovieItemElement(page, movie));
  if (direction === "append") {
    listElement.append(...elements);
  } else {
    listElement.prepend(...elements);
  }
}
function createSkeletonItemTemplate() {
  return `
    <li class="skeleton-item item">
      <div class="skeleton thumbnail"></div>
      <div class="item-desc">
        <div class="skeleton skeleton-rate"></div>
        <div class="skeleton skeleton-title"></div>
      </div>
    </li>
  `;
}
function createSkeletonItemsTemplate(count) {
  return Array.from({ length: count }).map(createSkeletonItemTemplate).join("");
}
function renderSkeletonItems(length, direction = "append") {
  const insertPosition = direction === "append" ? "beforeend" : "afterbegin";
  document.querySelector(".thumbnail-list")?.insertAdjacentHTML(insertPosition, createSkeletonItemsTemplate(length));
}
function removeSkeletonItems() {
  document.querySelectorAll(".skeleton-item").forEach((element) => element.remove());
}
function restoreScrollPosition() {
  const targetMovieId = getURLSearchParam("viewed-movie-id", void 0);
  if (targetMovieId) {
    setTimeout(() => {
      document.querySelector(`li[data-movie-id="${targetMovieId}"]`)?.scrollIntoView({ block: "center" });
    }, 0);
  }
}
export {
  removeSkeletonItems as a,
  bindClickMovieEvent as b,
  renderMovieItems as c,
  restoreScrollPosition as d,
  bindTopInfiniteScrollObserver as e,
  fetchMovies as f,
  bindBottomInfiniteScrollObserver as g,
  handleError as h,
  getPage as i,
  getQuery as j,
  renderSkeletonItems as r
};
