local WIDTH = 2048
local HEIGHT = 2048
local DIV = 32
local CHANCE = 0.8

io.write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n")
io.write("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""..WIDTH.."\" height=\""..HEIGHT.."\" viewport=\"0 0 "..WIDTH.." "..HEIGHT.."\">\n")
io.write(
	"\t<defs>\n",
	"\t\t<linearGradient id=\"a\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"0%\">\n",
	"\t\t\t<stop offset=\"0%\" style=\"stop-color:rgba(21,60,12,1)\"/>\n",
	"\t\t\t<stop offset=\"50%\" style=\"stop-color:rgba(77,25,35,1)\"/>\n",
	"\t\t\t<stop offset=\"100%\" style=\"stop-color:rgba(0,84,82,1)\"/>\n",
	"\t\t</linearGradient>\n",
	"\t</defs>\n",
	"\t<rect width=\"100%\" height=\"100%\" fill=\"url(#a)\"/>\n"
)

local STARCOLOR = {
	{155, 176, 255},
	{170, 191, 255},
	{202, 215, 255},
	{248, 247, 255},
	{255, 244, 234},
	{255, 210, 161},
	{255, 204, 111},
}

local function pickcolor()
	local a = STARCOLOR[math.random(1, #STARCOLOR)]
	return string.format("#%02x%02x%02x", a[1], a[2], a[3])
end

math.randomseed(os.time())

for y = 1, HEIGHT / DIV do
	for x = 1, WIDTH / DIV do
		if math.random() >= CHANCE then
			local px = math.floor(DIV * (x + math.random()) + 0.5)
			local py = math.floor(DIV * (y + math.random()) + 0.5)

			io.write("\t<circle cx=\""..px.."\" cy=\""..py.."\" r=\""..math.random(1,3).."\" fill=\""..pickcolor().."\"/>\n")
		end
	end
end

io.write("</svg>\n")
