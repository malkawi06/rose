# IN BLOOM

Rose · ASCII Code Art by JIN2, 2026

![White ASCII rose, generated from the included source](images/bloom-white.png)

## Artist's Note

A single line of light grows into a stem, a bud forms, and slowly, petal by petal, it opens.
A rose that is never cut and never fades, drawn only with letters, numbers and symbols.

The website version recreates the artwork in a browser canvas. It draws the glyphs, lighting, bloom and particles live, with white petals and the original green stem and leaves.

## Technology

Python · NumPy · pygame-ce

## Creative Process

1. Form: the stem, leaves, sepals and a closed bud are built in 3D.
2. Growth: a travelling point of light draws the stem up, then the bud fills in.
3. Bloom: one spiral surface loosens from the bud into a full rose, outer petals first.
4. Motion: a soft sway, petals trailing behind it, dewdrops that fall and splash.
5. ASCII Rendering: the scene becomes a grid of characters, shaded by brightness.

## Technical Concepts

3D geometry and rotation · parametric spiral surfaces · perspective projection with depth ordering
Diffuse and specular lighting · particle motion with gravity · outline detection · character-based shading

## Source Code

The full Python source is free and included in this folder.

```sh
pip install -r requirements.txt
python rose.py
```
Space pause, R restart, S screenshot, Esc quit.
Free for personal projects. Please credit @jin_22ee if you share what you make. See LICENSE.txt.

If you'd like to support my work, the same code is also on [Payhip](https://payhip.com/b/7WP5A).

---

Artist: JIN2 · Instagram [@jin_22ee](https://instagram.com/jin_22ee)
© 2026 JIN2. All rights reserved. Images and video in this repository may not be reused without permission.
