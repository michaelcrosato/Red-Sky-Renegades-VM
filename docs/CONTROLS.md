# Controls

The standard Gamepad API mapping is used. DualSense button names are the primary vocabulary. No proprietary controller SDK or account is required.

| Action                        | DualSense / standard controller             | Keyboard / mouse                                         |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Move                          | Left stick                                  | WASD                                                     |
| Look                          | Right stick                                 | Right mouse drag; arrow keys                             |
| Sprint / gallop               | Hold Cross                                  | Hold Shift                                               |
| Interact / mount / dismount   | Triangle                                    | E                                                        |
| Aim                           | Hold L2                                     | Hold right mouse                                         |
| Fire                          | R2                                          | Left mouse or Space                                      |
| Reload                        | Square                                      | R                                                        |
| Focus / slow time             | R3                                          | F                                                        |
| Equipment wheel               | Hold L1; left stick chooses; release equips | Hold Q; A/D choose guns, S chooses tonic; release equips |
| Select repeater               | R1 or D-pad Right                           | 2                                                        |
| Select revolver               | D-pad Left                                  | 1                                                        |
| Call Juniper                  | D-pad Up                                    | H                                                        |
| Drink tonic                   | D-pad Down                                  | C                                                        |
| Journal / map                 | Create / View                               | Tab                                                      |
| Pause                         | Options / Menu                              | Escape                                                   |
| Menu navigation               | D-pad or left stick                         | Arrows or WASD                                           |
| Select                        | Cross                                       | Enter or Space                                           |
| Back                          | Circle                                      | Escape or Backspace                                      |
| Change a setting / guide page | D-pad Left / Right                          | Left / Right arrows                                      |

Gamepad button and stick input interrupts the attract loop. Neutral sticks inside the dead zone do not count as activity. Losing window focus, hiding the tab, or disconnecting a controller pauses player gameplay. The controller’s vibration actuator is used when the browser exposes it.

The equipment wheel slows the simulation while held. Reloading consumes real reserve ammunition. Focus slows hostile simulation time while preserving responsive player movement and aim. Kills and recovery refill focus. A tonic restores 65 health and 25 focus; it cannot be consumed at full health.

Aim assistance only acquires living targets inside a narrow forward cone, in weapon range, and without blocking cover. The reticle turns red when it acquires a target. You may shoot while mounted, or dismount for a smaller profile.

The nearest eligible interaction appears in the lower center of the screen. Story interactions take priority over mounting to make delivery and investigation possible from horseback. If you leave Juniper behind, whistle to call her.

There are no mobile movement pads or touch combat buttons. The small menu button opens normal menus. A controller is the intended input on every supported device.
