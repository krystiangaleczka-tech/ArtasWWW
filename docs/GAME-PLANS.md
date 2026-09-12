# ARTAS — plany minigier

## ARTAS CONNECT — gra 2.5D

Cel: przeprowadzić cztery przewody od urządzeń do odpowiednich portów fikcyjnej centrali. Inspiracja zręcznościową grą „Operacja”; samodzielna grafika i plansza.

- Plansza: obwód w SVG, perspektywa 2.5D, cztery osobne kanały, symbole M/F/L/P oraz kolory.
- Pętla: chwyć złącze → prowadź w kanale → odłóż w pasującym porcie → połącz wszystkie obwody.
- Kolizje: odległość od odcinków polilinii; badanie całego ruchu co 3 jednostki zapobiega przeskakiwaniu przez ściany.
- Poziomy: promień tolerancji 21 lub 12 jednostek. Trzecie dotknięcie kończy próbę.
- Wynik: max(0, 1000 − 100 × dotknięcia − 2 × sekundy). Czas kończy się po zwycięstwie lub przegranej.
- Dostępność: symbole oprócz kolorów, wybór przewodu przyciskiem, strzałki przesuwają końcówkę, Enter zatwierdza, Escape odkłada. Mysz i dotyk korzystają z Pointer Events.
- Reset usuwa przewody, błędy i czas. Zmiana trudności odkłada aktywny przewód.
- Granica modelu: fikcyjna instalacja niskonapięciowa; bez rzeczywistych numerów zacisków, napięcia sieciowego czy zwierania zabezpieczeń.

Implementacja: `components/artas/WiringGame.tsx`, obliczenia `lib/artas/mechanics.ts`.

## ARTAS BUILD — gra 3D

Cel: rozpoznać zależności między zespołami i zbudować działający model rolety lub bramy.

- Plansza: model Three.js, widok rozstrzelony, metaliczne materiały, światło studyjne, obrót OrbitControls.
- Pętla: wybierz część w modelu lub przyciskiem → zamontuj przyciskiem albo upuść ją na model → sprawdź zależność → animowane dosunięcie.
- Roleta: prowadnice → korpus → wał z napędem → pancerz → listwa dolna → pokrywa. To dydaktyczne składanie zespołów, nie literalna kolejność montażu gotowej rolety w budynku.
- Brama: prowadnice pionowe → łuki i tory poziome → panele z rolkami i zawiasami → zespół równoważący → napęd → zabezpieczenia.
- Błędny wybór nie zmienia konstrukcji; wskazówka podaje brakujący zespół i jego funkcję. Poprawny wybór zwiększa postęp o 1/6.
- Finał: po wszystkich etapach dostępny test otwarcia i zamknięcia.
- Wszystkie operacje są dostępne zwykłymi przyciskami z klawiatury. Przeciąganie i wybieranie w scenie to dodatkowe sposoby obsługi.
- Reset i zmiana konstrukcji rozpoczynają nową próbę.
- Nie symulujemy naprężania sprężyn, regulacji siły i odbioru rzeczywistego urządzenia.

Implementacja: `components/artas/AssemblyGame.tsx`, `lib/artas/model.ts`; kolejność w `lib/artas/catalog.ts`.
