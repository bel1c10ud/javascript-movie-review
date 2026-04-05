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
function createMovieItemTemplate(movie) {
  return `
    <li>
      <div class="item">
        <img
          class="thumbnail"
          src="${"https://image.tmdb.org/t/p"}/w200${movie.poster_path}"
          onerror="this.src='/images/default_movie_image.png'"
          alt="${movie.title}"
        />
        <div class="item-desc">
          <p class="rate">
            <img src="${"/javascript-movie-review/"}images/star_empty.png" alt="empty star" class="star" />
            <span>${movie.vote_average.toFixed(1)}</span>
          </p>
          <p class="movie-title">${movie.title}</p>
        </div>
      </div>
    </li>
  `;
}
function renderMovieItemsToList(movieList) {
  const listElement = document.querySelector(".thumbnail-list");
  listElement?.insertAdjacentHTML("beforeend", movieList.map((movie) => createMovieItemTemplate(movie)).join(""));
}
function removeSkeletonItems() {
  document.querySelectorAll(".skeleton-item").forEach((element) => element.remove());
}
const SHOW_MORE_THROTTLE_MS = 500;
const FETCH_TIMEOUT_MS = 1e4;
const FETCH_OPTION = {
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyODEwZTc5YTJiZTY1MTBlYzg4MDVjM2QxYjU5MWFhOSIsIm5iZiI6MTc3NDg0NDAwOS4xMzkwMDAyLCJzdWIiOiI2OWM5Zjg2OWZmYTliZGM4ZWM0NGU2NjYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.qkDiOc1EJ1aP8EQ4z_1QW2WdEgA00xkmpFT47UOL-Oc"}`
  }
};
const ERROR = {
  APIError: "API 에러",
  UnknownError: "알 수 없는 에러"
};
class APIError extends Error {
  constructor(message) {
    super(message);
    this.name = "APIError";
  }
}
class UnknownError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnknownError";
  }
}
const TOAST_DURATION_MS = 5e3;
function createToast({ title, message }) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
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
function getURLSearchParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) ?? defaultValue;
}
function setURLSearchParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, "", url);
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
function setQuery(query) {
  setURLSearchParam("query", query);
}
function setPage(page) {
  setURLSearchParam("page", page.toString());
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
function handleError(catchedError) {
  const error = catchedError instanceof Error ? catchedError : new UnknownError("에러 객체를 찾을 수 없습니다.");
  const title = error.name in ERROR ? ERROR[error.name] : error.name;
  const message = error.message ?? "에러 메시지가 없습니다.";
  showErrorToast({ title, message });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetcher(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new APIError("API 응답이 올바르지 않습니다.");
  }
  return response.json();
}
async function fetchMovies(endpoint, params) {
  const queryParams = new URLSearchParams({
    language: "ko-KR",
    ...params
  });
  try {
    const fetchPromise = fetcher(`${"https://api.themoviedb.org/3"}${endpoint}?${queryParams}`, FETCH_OPTION);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new APIError(`API 응답 시간이 ${FETCH_TIMEOUT_MS}ms를 초과했습니다.`));
      }, FETCH_TIMEOUT_MS);
    });
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    throw error instanceof Error ? error : new APIError("API 요청중 에러가 발생했습니다.");
  }
}
async function fetchMoviesByPageRange(endpoint, startPage, endPage, query) {
  const promises = Array.from({ length: endPage - startPage }).map(
    async (_, index) => {
      if (index !== 0) await delay(index * 200);
      if (endpoint === "/search/movie") {
        return fetchMovies(endpoint, { page: startPage + index + 1, query });
      }
      return fetchMovies(endpoint, { page: startPage + index + 1 });
    }
  );
  return Promise.all(promises);
}
function createShowMoreButton() {
  const buttonElement = document.createElement("button");
  buttonElement.classList.add("show-more-button");
  buttonElement.textContent = "더보기";
  return buttonElement;
}
function renderShowMoreButton(prevResponseList, page, callback) {
  if (prevResponseList.length && prevResponseList[prevResponseList.length - 1].total_pages > page) {
    if (!document.querySelector(".show-more-button")) {
      const buttonElement = createShowMoreButton();
      buttonElement.addEventListener("click", throttle(callback, SHOW_MORE_THROTTLE_MS));
      document.querySelector(".thumbnail-list")?.insertAdjacentElement("afterend", buttonElement);
    }
  } else {
    document.querySelector(".show-more-button")?.remove();
  }
}
function createSkeletonItemTemplate() {
  return `
    <li class="skeleton-item">
      <div class="item">
        <div class="skeleton thumbnail"></div>
        <div class="item-desc">
          <div class="skeleton skeleton-rate"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
      </div>
    </li>
  `;
}
function createSkeletonItemsTemplate(count) {
  return Array.from({ length: count }).map(createSkeletonItemTemplate).join("");
}
function renderSkeletonItems(length) {
  document.querySelector(".thumbnail-list")?.insertAdjacentHTML("beforeend", createSkeletonItemsTemplate(length));
}
function renderTopRatedMovie(movie) {
  const rateEl = document.querySelector(".top-rated-movie .rate-value");
  const titleEl = document.querySelector(".top-rated-movie .title");
  const detailButtonEl = document.querySelector(
    ".top-rated-movie .detail"
  );
  const backgroundContainerEl = document.querySelector(
    ".background-container"
  );
  if (titleEl) {
    titleEl.textContent = movie.title;
  }
  if (rateEl) {
    rateEl.textContent = movie.vote_average.toFixed(1);
  }
  if (detailButtonEl) {
    detailButtonEl.disabled = false;
  }
  if (backgroundContainerEl) {
    backgroundContainerEl.style.backgroundImage = `url(${"https://image.tmdb.org/t/p"}/w1920_and_h800_multi_faces${movie.backdrop_path})`;
  }
}
export {
  removeSkeletonItems as a,
  renderMovieItemsToList as b,
  renderShowMoreButton as c,
  renderTopRatedMovie as d,
  setQuery as e,
  fetchMoviesByPageRange as f,
  getPage as g,
  handleError as h,
  getQuery as i,
  renderSkeletonItems as r,
  setPage as s
};
