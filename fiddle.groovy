def list = [[p: 1], [p: 2], [p: 3]]

def (l1, l2) = list.split { it.p < 2 }
println l1
println l2

list = [1, 2, 3]
list.addAll([1, 2, 3])
println list - [2, 3]
