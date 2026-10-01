"use client";

import { NavMenu } from "@shopify/app-bridge-react";

/** M0 embedded nav shell — Home + Plans & Usage only. */
export function AppNav() {
  return (
    <NavMenu>
      <a href="/" rel="home">
        Home
      </a>
      <a href="/plans">Plans &amp; Usage</a>
    </NavMenu>
  );
}
