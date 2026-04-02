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
const FETCH_OPTION = {
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyODEwZTc5YTJiZTY1MTBlYzg4MDVjM2QxYjU5MWFhOSIsIm5iZiI6MTc3NDg0NDAwOS4xMzkwMDAyLCJzdWIiOiI2OWM5Zjg2OWZmYTliZGM4ZWM0NGU2NjYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.qkDiOc1EJ1aP8EQ4z_1QW2WdEgA00xkmpFT47UOL-Oc"}`
  }
};
const SHOW_MORE_TROTTLE_MS = 500;
const FETCH_TIMEOUT_MS = 1e4;
function getPramFromURL(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) ?? defaultValue;
}
function getPage() {
  const pageStr = getPramFromURL("page", "1");
  const page = isNaN(Number(pageStr)) ? 1 : Number(pageStr);
  return Math.max(1, page);
}
function setPage(page) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", String(page));
  window.history.replaceState({}, "", url);
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
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function timeoutFn(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`요청 시간이 ${ms}ms를 초과했습니다.`));
    }, ms);
  });
}
async function fetchMovies(endpoint, params) {
  const queryParams = new URLSearchParams({
    language: "ko-KR",
    ...params
  });
  try {
    const fetchPromise = fetch(`${"https://api.themoviedb.org/3"}${endpoint}?${queryParams}`, FETCH_OPTION).then((res) => res.json());
    return await Promise.race([fetchPromise, timeoutFn(FETCH_TIMEOUT_MS)]);
  } catch (error) {
    const newError = new Error();
    newError.name = "API 요청중 에러가 발생했습니다.";
    newError.message = `${error instanceof Error ? error.message ?? "not found error message" : "not found error"} (${endpoint})`;
    throw newError;
  }
}
async function fetchPopularMoviesByPageRange(startPage, endPage) {
  const promises = Array.from({ length: endPage - startPage }).map(
    async (_, index) => {
      if (index !== 0) await delay(index * 200);
      return fetchMovies("/movie/popular", { page: startPage + index + 1 });
    }
  );
  return Promise.all(promises);
}
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
            <img src="${"/javascript-movie-review/"}images/star_empty.png" class="star" />
            <span>${movie.vote_average.toFixed(1)}</span>
          </p>
          <p class="movie-title">${movie.title}</p>
        </div>
      </div>
    </li>
  `;
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
function renderMovies(movieList) {
  document.querySelector(".thumbnail-list")?.insertAdjacentHTML(
    "beforeend",
    movieList.map((movie) => createMovieItemTemplate(movie)).join("")
  );
}
function renderShowMoreButton(prevResponseList, page, callback) {
  if (prevResponseList.length && prevResponseList[prevResponseList.length - 1].total_pages > page) {
    if (!document.querySelector(".show-more-button")) {
      const button = document.createElement("button");
      button.classList.add("show-more-button");
      button.textContent = "더보기";
      button.addEventListener("click", throttle(callback, SHOW_MORE_TROTTLE_MS));
      document.querySelector(".thumbnail-list")?.insertAdjacentElement("afterend", button);
    }
  } else {
    document.querySelector(".show-more-button")?.remove();
  }
}
function removeSkeletonItem() {
  document.querySelectorAll(".skeleton-item").forEach((element) => element.remove());
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
addEventListener("load", async () => {
  let prevResponseList = [];
  try {
    async function renderPopularMoviePage(page) {
      setPage(page);
      renderSkeletonItems(20);
      const responseList = await fetchPopularMoviesByPageRange(
        prevResponseList.length,
        page
      );
      removeSkeletonItem();
      prevResponseList.push(...responseList);
      const movieList = responseList.reduce((arr, response) => {
        return [...arr, ...response.results];
      }, []);
      renderMovies(movieList);
      renderShowMoreButton(prevResponseList, page, () => {
        renderPopularMoviePage(getPage() + 1);
      });
    }
    await renderPopularMoviePage(getPage());
    if (prevResponseList.length && prevResponseList[0].results.length) {
      renderTopRatedMovie(prevResponseList[0].results[0]);
    }
  } catch (error) {
    if (error instanceof Error) {
      showErrorToast({ title: error.name, message: error.message });
    }
  }
});
