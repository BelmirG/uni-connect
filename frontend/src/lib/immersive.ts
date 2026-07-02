// Routes that take over the full viewport (chat views): the floating NavBar is
// hidden and the global body bottom-padding is removed so the composer sits flush
// at the bottom edge.
export function isImmersiveRoute(pathname: string): boolean {
  // DM conversation: /messages/<id>  (but NOT the /messages list)
  if (/^\/messages\/[^/]+$/.test(pathname)) return true;
  // Club chat: /clubs/<slug>/chat
  if (/^\/clubs\/[^/]+\/chat$/.test(pathname)) return true;
  return false;
}
