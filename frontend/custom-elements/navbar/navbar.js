const navbars = document.querySelectorAll(".nav-1");

navbars.forEach((navbar) => {
  const links = navbar.querySelectorAll("a");
  const tabs = [...links].map(link => document.getElementById(link.href.split("#")[1]));

  links.forEach((link) => {
    link.addEventListener("click", () => {
      // deactivate all links in this navbar
      links.forEach((l) => l.classList.remove("active"));
      // activate the clicked link
      link.classList.add("active");
      // show the corresponding tab
      tabs.forEach((t) => t.style.display = "none");

      const correspondingTab = document.getElementById(link.href.split("#")[1]);
      if (correspondingTab) {
        correspondingTab.style.display = "flex";
      }
      else{
        console.warn("No corresponding tab found for link: " + link.href + ". Make sure there is a tab with id '" + link.href.split("#")[1] + "', or change the href attribute of the link.");
      }
      });
  });
});
