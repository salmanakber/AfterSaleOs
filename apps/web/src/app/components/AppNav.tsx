"use client";

import { NavMenu } from "@shopify/app-bridge-react";

export function AppNav() {
  return (
    <NavMenu>
      <a href="/" rel="home">
        Home
      </a>
      <a href="/warranties">Warranties</a>
      <a href="/registrations">Registrations</a>
      <a href="/products-rules">Products &amp; Rules</a>
      <a href="/plans">Plans &amp; Usage</a>
    </NavMenu>
  );
}
