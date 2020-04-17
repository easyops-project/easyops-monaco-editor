import { IRoute } from "./IRoute.interface";

const routes: IRoute[] = [
  {
    route: "Map",
    routeFunc: $event => {
      setActiveRoute("Map");
    }
  },
  {
    route: "Output",
    routeFunc: $event => {
      setActiveRoute("Output");
    }
  }
];

function main() {
  const routeNav: HTMLElement | null = document.getElementById("routeNav");
  if (routeNav !== null) {
    let i: number = 0;
    routes.forEach(route => {
      const el: HTMLDivElement = document.createElement("div");
      el.innerHTML = `<h6>${route.route}</h6>`;
      el.onclick = route.routeFunc;
      el.className = "navItem";
      el.id = route.route;

      if (i == 0) {
        el.className += " active";
        route.routeFunc(null);
      }

      routeNav.appendChild(el);
      i++;
    });
  }
}

export function setActiveRoute(routeName: string) {
  const routeNav: HTMLElement | null = document.getElementById("routeNav");

  for (let i = 0; i < (routeNav?.children.length || 0); i++) {
    const element: Element | undefined | null = routeNav?.children.item(i);

    if (element?.id !== routeName) {
      element?.classList.remove("active");
    } else {
      element.classList.add("active");
    }
  }

  const elements: HTMLCollectionOf<Element> = document.getElementsByClassName('route')
  for (let i = 0; i < elements.length; i++) {
    if (elements.item(i)?.id != routeName.toLowerCase()) {
      (elements.item(i) as HTMLElement).hidden = true;
    } else {
      (elements.item(i) as HTMLElement).hidden = false;
    }
  }
}

main();
