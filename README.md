# ARTAS — Architektura komfortu

Interaktywna strona po polsku: Three.js, React 19, TypeScript i Vinext. Na podstawie dostarczonego projektu ARTAS.

## Zawartość

- Otwarcie rolety przewijaniem, prędkość 70% bazowej, ograniczenie ruchu i pominięcie animacji.
- 17 podstron produktów `/produkty/<slug>`, osobne sekcje osłon i architektury zewnętrznej.
- 8 konstrukcji 3D: rozkładanie, składanie, otwarcie, obrót, zoom i półprzekrój.
- 16 wykończeń; rolety 39/43/52 mm, brama rolowana 77 mm, bramy segmentowe 500/555/610 mm.
- Przymiarka na zdjęciu domu: cztery narożniki, perspektywa, porównanie, eksport PNG. Zdjęcia pozostają w przeglądarce.
- Tryptyk gier ładowanych leniwie: Gate Rush, Monter 600 N i Tryb nauki; obsługa dotykiem i klawiaturą.
- Oryginalna galeria, przebieg współpracy, automatyka, części i kontakt.
- Opcjonalne WebMCP: odczyt i zmiana widocznej konfiguracji. Brak zależności działania strony od WebMCP.

## Uruchomienie

Node.js >= 22.13 i pnpm w wersji wskazanej w `package.json`.

```sh
pnpm install
pnpm dev
```

Budowa: `pnpm build`. W Sites używane są dostarczone skrypty budowy i publikacji. Manifest `.openai/hosting.json` identyfikuje wdrożenie Sites niezależne od dodatkowego repozytorium GitHub.

## Dokumentacja

- [Plany minigier](docs/GAME-PLANS.md)
- [Źródła i granice odwzorowania](docs/TECHNICAL-SOURCES.md)
- [Weryfikacja](docs/VERIFICATION.md)

Wizualizacje nie są dokumentacją produkcyjną. Konkretny system i wykończenia dobiera ARTAS. Kontakt przez telefon i e-mail; brak wysyłania formularzy lub zamówień.
