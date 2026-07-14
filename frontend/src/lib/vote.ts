// Optimistic vote arithmetic. Waiting a full server round-trip before the
// number moves makes every tap feel laggy, so pages apply this transition
// instantly, then reconcile with the server's authoritative response (or roll
// back to the pre-tap snapshot if the request fails).

export interface VoteFields {
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
}

export function applyVote<T extends VoteFields>(post: T, voteType: "up" | "down"): T {
  let { upvotes, downvotes, current_user_vote: cur } = post;
  if (cur === voteType) {
    // Tapping the same arrow again removes the vote.
    if (voteType === "up") upvotes -= 1;
    else downvotes -= 1;
    cur = null;
  } else {
    if (cur === "up") upvotes -= 1;
    if (cur === "down") downvotes -= 1;
    if (voteType === "up") upvotes += 1;
    else downvotes += 1;
    cur = voteType;
  }
  return { ...post, upvotes, downvotes, current_user_vote: cur };
}
