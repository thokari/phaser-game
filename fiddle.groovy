def queue = [ 1, 2, 3, 4, 5 ] as Queue

queue << 6
queue = queue - queue[1..3]
println queue
