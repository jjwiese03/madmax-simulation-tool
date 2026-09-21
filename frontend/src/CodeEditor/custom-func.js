
/**
 * custom function definitions for the editor
 */


window.add = (disc, deselectOthers = true) => {
    if (disc && typeof disc.toJs === "function") {
        disc = disc.toJs();
    }

    return window.discplot.discConfig.addDisc(disc, deselectOthers);
};

window.getDisc = (index) => {
    const discs = window.discplot.discConfig.discs
    if (index >= discs.length) return null;

    return discs[index]
}

window.delete = (index) => {
    const disc = window.getDisc(index)

    if (disc == null) return ;

    disc.delete()

    return ;
}

window.deleteAll = () => {
    window.discplot.discConfig.clear()

    return ;
}

window.changeProperty = (disc, properties) => {
    if (disc && typeof disc.toJs === "function") {
            disc = disc.toJs();
    }
    if (properties && typeof properties.toJs === "function") {
            properties = properties.toJs();
    }
    disc.changeProperty(properties)
}



/**
 * Example Codes 
 */



window.CODE_EXAMPLES = {
    animation: `# -- CODE EXAMPLE -- 
from js import *
import asyncio

async def Animation(disc):
    # animate the disc while moving 2cm to the right
    for i in range(100):
        disc.move(0.01, dx=True)
        await asyncio.sleep(0.1)
    # delete disc
    await asyncio.sleep(2)
    disc.delete()
    return None

# add a disc to the discplot
disc = add({'width': 2, 'position': 4})

# wait for 3 seconds
await asyncio.sleep(3)

await Animation(disc)`,
    basics: `# -- BASICS --
from js import add, getDisc, deleteAll, changeProperty
import asyncio

# clear the current setup
deleteAll()
# wait for 3 seconds
await asyncio.sleep(3)

# add one disc and save it as "first_disc"
first_disc = add({"width": 0.1, "position": 2})
await asyncio.sleep(3)

# add 4 more discs
for p in [3, 4, 5, 6]:
    add({"position": p})
await asyncio.sleep(3)

# select second disc by index (index = 1) and change its width
second_disc = getDisc(1)
changeProperty(second_disc, {"width": 0.5})
await asyncio.sleep(3)


# move the first disc to 4cm
first_disc.move(4)`
}