// Real playlist poems from the author's Spotify library, rendered as a
// small Spotify-look preview on the landing page. Display only — no links.

const EXAMPLES = [
  {
    name: "Poem 1",
    cover: ["#abd2fa", "#1b2cc1"],
    tracks: [
      ["Lovin' You", "Minnie Riperton"],
      ["Hard To Explain", "The Strokes"],
      ["I Like The Way You Walk", "The Donkeys"],
      ["I Like The Way You Love Me", "Brenton Wood"],
      ["Guess I Always Knew", "Love Apple, Lou Ragland"],
      ["I Like", "Kut Klose"],
      ["You", "Larry Lovestein & The Velvet Revival"],
      ["Early Morning Rain", "Cleveland Francis"],
      ["Sun Rays Like Stilts", "Tommy Guerrero"],
      ["Late July", "Zach Bryan"],
      ["Midnight", "Mapache"],
      ["You and I", "Washed Out"],
      ["Wherever You Go", "Beach House"],
      ["Give You My Lovin", "Mazzy Star"],
      ["Beautiful Girl", "INXS"],
      ["You And Me", "Penny & The Quarters"],
      ["Sweetest Thing on This Side of Heaven", "Papa Bear & His Cubs"],
    ],
  },
  {
    name: "Poem 2",
    cover: ["#f2b56b", "#3d518c"],
    tracks: [
      ["Why Are Sundays So Depressing", "The Strokes"],
      ["It's Not Easy", "Ofege"],
      ["Real Life", "ear"],
      ["The Man in Me", "Bob Dylan"],
      ["Miffed It", "Way Dynamic"],
      ["Whatcha Gonna Do", "The Valdons"],
      ["Before the Sun", "Gregory Alan Isakov"],
      ["Life's Been Good", "Joe Walsh"],
      ["Warm Love", "Van Morrison"],
      ["Carry Me Away", "John Mayer"],
      ["Set Adrift On Memory Bliss", "P.M. Dawn"],
      ["next time i'll be a frog in a mossy glen", "coulou's cafe, COULOU"],
    ],
  },
  {
    name: "Poem 3",
    cover: ["#7692ff", "#091540"],
    tracks: [
      ["California", "The Lagoons"],
      ["Feels Like Home", "Caamp"],
      ["Next to You", "John Vincent III"],
      ["Colorado", "Sam Burchfield"],
      ["Feels Like Summer", "Childish Gambino"],
      ["When You're Around", "Dune Rats"],
      ["Pink Skies", "Zach Bryan"],
      ["Wildflowers", "Tom Petty"],
      ["Sleep On The Floor", "The Lumineers"],
      ["Waste My Time", "The Grogans"],
      ["Stay", "Daily J"],
      ["Stay Home With Me", "J Lloyd"],
      ["Take Me Where Your Heart Is", "Q"],
      ["Add Up My Love", "Clairo"],
      ["It's Just Us", "Kali Uchis"],
      ["Over the Moon", "The Marías"],
      ["I Guess I Just Feel Like", "John Mayer"],
      ["You Deserve This", "Men I Trust"],
      ["Forever and More", "Jaguar Sun"],
      ["And Now", "tomemitsu"],
      ["Nothing's Gonna Hurt You Baby", "Cigarettes After Sex"],
    ],
  },
];

export function initExamples() {
  const tabs = document.getElementById("example-tabs");
  const card = document.getElementById("sp-card");
  if (!tabs || !card) return;

  let current = 0;

  const renderTabs = () => {
    tabs.innerHTML = "";
    EXAMPLES.forEach((ex, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "example-tab" + (i === current ? " active" : "");
      b.textContent = ex.name;
      b.onclick = () => { current = i; render(); };
      tabs.appendChild(b);
    });
  };

  const render = () => {
    renderTabs();
    const ex = EXAMPLES[current];
    card.innerHTML = "";

    const header = document.createElement("div");
    header.className = "sp-header";
    header.style.background = `linear-gradient(180deg, ${ex.cover[1]}66 0%, transparent 100%)`;

    const cover = document.createElement("div");
    cover.className = "sp-cover";
    cover.style.background = `linear-gradient(135deg, ${ex.cover[0]}, ${ex.cover[1]})`;
    cover.textContent = "♪";

    const meta = document.createElement("div");
    meta.className = "sp-meta";
    meta.innerHTML = `<span class="sp-type">Public Playlist</span><h3 class="sp-title"></h3><span class="sp-sub"></span>`;
    meta.querySelector(".sp-title").textContent = ex.name;
    meta.querySelector(".sp-sub").textContent = `${ex.tracks.length} songs`;

    header.append(cover, meta);

    const list = document.createElement("ol");
    list.className = "sp-tracks";
    ex.tracks.forEach(([title, artist], i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="sp-num"></span><div class="sp-cell"><div class="sp-track"></div><div class="sp-artist"></div></div>`;
      li.querySelector(".sp-num").textContent = i + 1;
      li.querySelector(".sp-track").textContent = title;
      li.querySelector(".sp-artist").textContent = artist;
      list.appendChild(li);
    });

    card.append(header, list);
    card.scrollTop = 0;
  };

  render();
}
