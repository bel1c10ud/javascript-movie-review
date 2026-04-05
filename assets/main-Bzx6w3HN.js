import { r as renderSkeletonItems, f as fetchMoviesByPageRange, s as setPage, a as removeSkeletonItems, b as renderMovieItemsToList, c as renderShowMoreButton, g as getPage, h as handleError, d as renderTopRatedMovie } from "./renderTopRatedMovie-DN_vNPvA.js";
addEventListener("load", async () => {
  let prevResponseList = [];
  try {
    async function renderPopularMoviePage(initPage) {
      renderSkeletonItems(20);
      const responseList = await fetchMoviesByPageRange(
        "/movie/popular",
        prevResponseList.length,
        initPage
      );
      setPage(initPage);
      removeSkeletonItems();
      prevResponseList.push(...responseList);
      const movieList = responseList.reduce((arr, response) => {
        return [...arr, ...response.results];
      }, []);
      renderMovieItemsToList(movieList);
      renderShowMoreButton(prevResponseList, initPage, async () => {
        try {
          await renderPopularMoviePage(getPage() + 1);
        } catch (error) {
          handleError(error);
        } finally {
          removeSkeletonItems();
        }
      });
    }
    await renderPopularMoviePage(getPage());
    if (prevResponseList.length && prevResponseList[0].results.length) {
      renderTopRatedMovie(prevResponseList[0].results[0]);
    }
  } catch (error) {
    handleError(error);
  } finally {
    removeSkeletonItems();
  }
});
