"use client";

import NextLink from "next/link";
import {
  useRouter,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
  usePathname,
} from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

type RouterClassName =
  | ComponentProps<typeof NextLink>["className"]
  | ((props: { isActive: boolean; isPending: boolean }) => string | undefined);

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href" | "className"> & {
  to?: string;
  href?: string;
  className?: ComponentProps<typeof NextLink>["className"];
  // react-router accepts `replace` as a flat boolean prop. next/link
  // supports the same prop name and shape, so forward it through.
  replace?: boolean;
  state?: unknown;
};

type NavLinkProps = Omit<LinkProps, "className" | "children"> & {
  className?: RouterClassName;
  children?:
    | ReactNode
    | ((props: { isActive: boolean; isPending: boolean }) => ReactNode);
  end?: boolean;
};

export function Link({ to, href, children, state: _state, ...rest }: LinkProps) {
  const target = href ?? to ?? "#";
  return (
    <NextLink href={target} {...rest}>
      {children}
    </NextLink>
  );
}

export function NavLink({
  to,
  href,
  children,
  className,
  end,
  state: _state,
  ...rest
}: NavLinkProps) {
  const pathname = usePathname() ?? "/";
  const target = href ?? to ?? "#";
  const isActive =
    target === pathname ||
    (!end && target !== "/" && pathname.startsWith(`${target}/`));
  const resolvedClassName =
    typeof className === "function"
      ? className({ isActive, isPending: false })
      : className;
  return (
    <NextLink href={target} className={resolvedClassName} {...rest}>
      {typeof children === "function"
        ? children({ isActive, isPending: false })
        : children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();
  return (path: string | number, opts?: { replace?: boolean; state?: unknown }) => {
    if (typeof path === "number") {
      if (typeof window !== "undefined") window.history.go(path);
      return;
    }
    if (opts?.replace) router.replace(path);
    else router.push(path);
  };
}

export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): T {
  return (useNextParams() ?? {}) as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (
    init: URLSearchParams | Record<string, string>,
    opts?: { replace?: boolean },
  ) => void,
] {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (
    init: URLSearchParams | Record<string, string>,
    opts?: { replace?: boolean },
  ) => {
    const usp =
      init instanceof URLSearchParams ? init : new URLSearchParams(init);
    const search = usp.toString();
    const url = search ? `${pathname}?${search}` : (pathname ?? "/");
    if (opts?.replace) router.replace(url);
    else router.push(url);
  };
  return [new URLSearchParams(params?.toString() ?? ""), set];
}

export function useLocation() {
  const pathname = usePathname();
  const params = useNextSearchParams();
  return {
    pathname: pathname ?? "/",
    search: params?.toString() ? `?${params.toString()}` : "",
    hash: typeof window !== "undefined" ? window.location.hash : "",
    state: null,
  };
}

// react-router exports kept for compatibility with bare destructures.
// Routing in V2 is owned by Next.js, so these are no-ops or escape hatches.
export function BrowserRouter({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Routes({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Outlet() {
  return null;
}
export function Route(_props: { path?: string; element?: ReactNode }) {
  return null;
}
export function Navigate({
  to,
  replace: _replace,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}) {
  if (typeof window !== "undefined") window.location.href = to;
  return null;
}

export { usePathname };
