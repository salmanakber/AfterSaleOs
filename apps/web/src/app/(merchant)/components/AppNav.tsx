"use client";

import { NavMenu } from "@shopify/app-bridge-react";

export function AppNav() {
  return (
    <NavMenu>
      <a href="/" rel="home">
        Home
      </a>
      <a href="/claims">Claims</a>
      <a href="/repairs">Repairs</a>
      <a href="/resolutions">Resolutions</a>
      <a href="/suppliers">Suppliers</a>
      <a href="/warranties">Warranties</a>
      <a href="/registrations">Registrations</a>
      <a href="/products-rules">Products &amp; Rules</a>
      <a href="/automations">Automations</a>
      <a href="/settings">Customer pages</a>
      <a href="/plans">Plans &amp; Usage</a>
    </NavMenu>
  );
}
